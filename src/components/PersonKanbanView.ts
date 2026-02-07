import { showMessage, confirm, Menu, Dialog } from "siyuan";
import { refreshSql, getBlockKramdown, getBlockByID, updateBindBlockAtrrs, openBlock } from "../api";
import { getLocalDateString, getLocalDateTimeString, compareDateStrings, getLogicalDateString, getRelativeDateString } from "../utils/dateUtils";
import { QuickReminderDialog } from "./QuickReminderDialog";
import { CategoryManager } from "../utils/categoryManager";
import { PersonManager } from "../utils/personManager";
import { BlockBindingDialog } from "./BlockBindingDialog";
import { i18n } from "../pluginInstance";
import { createAssigneeElement } from "../utils/uiHelpers";
import { generateRepeatInstances, getRepeatDescription, getDaysDifference, addDaysToDate } from "../utils/repeatUtils";
import { PomodoroTimer } from "./PomodoroTimer";
import { PomodoroManager } from "../utils/pomodoroManager";
import { PomodoroRecordManager } from "../utils/pomodoroRecord";
import { getSolarDateLunarString, getNextLunarMonthlyDate, getNextLunarYearlyDate } from "../utils/lunarUtils";

interface PersonTask {
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low' | 'none';
    projectId?: string;
    projectName?: string;
    completed: boolean;
    date: string;
    time?: string;
    note?: string;
    blockId?: string;
    assigneeId?: string;
    parentId?: string;
    pomodoroCount?: number;
    focusTime?: number;
    sort?: number;
    createdTime?: string;
    endDate?: string;
    categoryId?: string;
    repeat?: any;
    isRepeatInstance?: boolean;
    originalId?: string;
    children?: PersonTask[];
}

interface PersonColumn {
    id: string;
    name: string;
    tasks: PersonTask[];
}

export class PersonKanbanView {
    private container: HTMLElement;
    private plugin: any;
    private categoryManager: CategoryManager;
    private personManager: PersonManager;
    private currentSort: string = 'priority';
    private currentSortOrder: 'asc' | 'desc' = 'desc';
    private doneSort: string = 'completedTime';
    private doneSortOrder: 'asc' | 'desc' = 'desc';
    private columns: PersonColumn[] = [];
    private isDragging: boolean = false;
    private draggedTask: any = null;
    private draggedElement: HTMLElement | null = null;
    private sortButton: HTMLButtonElement;
    private doneSortButton: HTMLButtonElement;
    private isLoading: boolean = false;
    private needsReload: boolean = false;
    private searchKeyword: string = '';
    private searchInput: HTMLInputElement;
    private collapsedTasks: Set<string> = new Set();
    private pomodoroManager = PomodoroManager.getInstance();
    private pomodoroRecordManager: PomodoroRecordManager;
    private selectedCategories: string[] = [];
    private categoryFilterButton: HTMLButtonElement;
    private reminderUpdatedHandler: (event?: CustomEvent) => void;

    constructor(container: HTMLElement, plugin?: any) {
        this.container = container;
        this.plugin = plugin;
        this.categoryManager = CategoryManager.getInstance(this.plugin);
        this.personManager = PersonManager.getInstance(this.plugin);
        this.pomodoroRecordManager = PomodoroRecordManager.getInstance(this.plugin);

        this.reminderUpdatedHandler = (event?: CustomEvent) => {
            if (event && event.detail && event.detail.source === 'personKanban') {
                return;
            }
            this.loadTasks();
        };

        this.initializeAsync();
    }

    private async initializeAsync() {
        await this.categoryManager.initialize();
        await this.personManager.initialize();
        this.initUI();
        this.loadTasks();

        window.addEventListener('reminderUpdated', this.reminderUpdatedHandler);
    }

    private initUI() {
        this.container.classList.add('person-kanban-view');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'kanban-header';

        const title = document.createElement('h2');
        title.textContent = i18n('personKanbanView') || '责任人看板';

        const controls = document.createElement('div');
        controls.className = 'kanban-controls';
        controls.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 16px;
        `;

        this.categoryFilterButton = document.createElement('button');
        this.categoryFilterButton.className = 'b3-button b3-button--outline';
        this.categoryFilterButton.style.cssText = `
            display: inline-block;
            max-width: 200px;
            box-sizing: border-box;
            padding: 0 8px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
            text-align: left;
        `;
        this.categoryFilterButton.addEventListener('click', () => this.showCategorySelectDialog());
        controls.appendChild(this.categoryFilterButton);

        this.searchInput = document.createElement('input');
        this.searchInput.className = 'b3-text-field';
        this.searchInput.type = 'text';
        this.searchInput.placeholder = i18n('searchTasks') || '搜索任务...';
        this.searchInput.style.cssText = 'flex: 1;';
        this.searchInput.addEventListener('input', () => {
            this.searchKeyword = this.searchInput.value.trim();
            this.loadTasks();
        });
        controls.appendChild(this.searchInput);

        this.sortButton = document.createElement('button');
        this.sortButton.className = 'b3-button b3-button--outline';
        this.sortButton.innerHTML = '<svg class="b3-button__icon"><use xlink:href="#iconSort"></use></svg>';
        this.sortButton.title = i18n('sortBy') || '排序';
        this.sortButton.addEventListener('click', (e) => this.showSortMenu(e));
        controls.appendChild(this.sortButton);

        this.doneSortButton = document.createElement('button');
        this.doneSortButton.className = 'b3-button b3-button--outline';
        this.doneSortButton.innerHTML = '<svg class="b3-button__icon"><use xlink:href="#iconSort"></use></svg>';
        this.doneSortButton.title = '已完成排序';
        this.doneSortButton.addEventListener('click', (e) => this.showDoneSortMenu(e));
        controls.appendChild(this.doneSortButton);

        header.appendChild(title);
        header.appendChild(controls);
        this.container.appendChild(header);

        const kanbanContainer = document.createElement('div');
        kanbanContainer.className = 'kanban-container';
        kanbanContainer.style.cssText = `
            display: flex;
            gap: 16px;
            overflow-x: auto;
            padding-bottom: 16px;
        `;
        this.container.appendChild(kanbanContainer);

        this.updateCategoryFilterButtonText();
    }

    private async loadTasks() {
        if (this.isLoading) {
            this.needsReload = true;
            return;
        }
        this.isLoading = true;

        try {
            const reminderData = await this.plugin.loadReminderData() || {};
            const persons = this.personManager.getPersons();

            const tasks: PersonTask[] = [];
            for (const id in reminderData) {
                const reminder = reminderData[id];
                if (reminder && !reminder.completed) {
                    tasks.push({
                        id: reminder.id,
                        title: reminder.title,
                        priority: reminder.priority || 'none',
                        projectId: reminder.projectId,
                        completed: reminder.completed,
                        date: reminder.date,
                        time: reminder.time,
                        note: reminder.note,
                        blockId: reminder.blockId,
                        assigneeId: reminder.assigneeId,
                        parentId: reminder.parentId,
                        pomodoroCount: reminder.pomodoroCount || 0,
                        focusTime: reminder.focusTime || 0,
                        sort: reminder.sort || 0,
                        createdTime: reminder.createdTime,
                        endDate: reminder.endDate,
                        categoryId: reminder.categoryId,
                        repeat: reminder.repeat,
                        isRepeatInstance: reminder.isRepeatInstance,
                        originalId: reminder.originalId,
                        children: []
                    });
                }
            }

            let filteredTasks = tasks;

            if (this.selectedCategories.length > 0 && !this.selectedCategories.includes('all')) {
                filteredTasks = filteredTasks.filter(task => {
                    const categoryIdStr = task.categoryId || 'none';
                    const taskCategoryIds = categoryIdStr.split(',').filter((id: string) => id);

                    if (taskCategoryIds.length === 0) {
                        return this.selectedCategories.includes('none');
                    }

                    return taskCategoryIds.some((id: string) => this.selectedCategories.includes(id));
                });
            }

            if (this.searchKeyword) {
                const searchTerms = this.searchKeyword.trim().split(/\s+/).filter(term => term.length > 0);
                filteredTasks = filteredTasks.filter(task => {
                    const searchableText = [
                        task.title || '',
                        task.note || ''
                    ].join(' ').toLowerCase();
                    return searchTerms.every(term => searchableText.includes(term.toLowerCase()));
                });
            }

            const taskMap = new Map<string, PersonTask>();
            filteredTasks.forEach(t => {
                taskMap.set(t.id, t);
                if (t.parentId && taskMap.has(t.parentId)) {
                    const parent = taskMap.get(t.parentId)!;
                    if (!parent.children) parent.children = [];
                    parent.children.push(t);
                }
            });

            const rootTasks = filteredTasks.filter(t => !t.parentId || !taskMap.has(t.parentId));

            this.columns = [];

            const allColumn: PersonColumn = {
                id: 'all',
                name: i18n('allAssignees') || '全部责任人',
                tasks: rootTasks
            };
            this.columns.push(allColumn);

            const noAssigneeColumn: PersonColumn = {
                id: 'none',
                name: i18n('noAssignee') || '无责任人',
                tasks: rootTasks.filter(t => !t.assigneeId)
            };
            this.columns.push(noAssigneeColumn);

            persons.forEach(person => {
                const personTasks = rootTasks.filter(t => t.assigneeId === person.id);
                this.columns.push({
                    id: person.id,
                    name: person.name,
                    tasks: personTasks
                });
            });

            this.sortColumns();
            this.renderKanban();
        } catch (error) {
            console.error('加载任务失败:', error);
            showMessage(i18n('loadRemindersFailed') || '加载任务失败');
        } finally {
            this.isLoading = false;
            if (this.needsReload) {
                this.needsReload = false;
                window.setTimeout(() => this.loadTasks(), 50);
            }
        }
    }

    private sortColumns() {
        this.columns.forEach(column => {
            if (column.id === 'none') {
                column.tasks.sort((a: any, b: any) => {
                    if (this.doneSortOrder === 'desc') {
                        return b.pomodoroCount - a.pomodoroCount;
                    } else {
                        return a.pomodoroCount - b.pomodoroCount;
                    }
                });
            } else {
                column.tasks.sort((a: any, b: any) => {
                    let result = 0;

                    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1, 'none': 0 };
                    const priorityA = priorityOrder[a.priority || 'none'] || 0;
                    const priorityB = priorityOrder[b.priority || 'none'] || 0;
                    const priorityDiff = priorityB - priorityA;

                    if (priorityDiff !== 0) {
                        result = priorityDiff;
                    } else {
                        const sortA = a.sort || 0;
                        const sortB = b.sort || 0;

                        if (sortA !== sortB) {
                            result = sortA - sortB;
                        } else {
                            const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
                            const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
                            result = timeB - timeA;
                        }
                    }

                    if (this.currentSortOrder === 'desc') {
                        result = -result;
                    }
                    return result;
                });
            }
        });
    }

    private renderKanban() {
        const kanbanContainer = this.container.querySelector('.kanban-container') as HTMLElement;
        if (!kanbanContainer) return;

        kanbanContainer.innerHTML = '';

        this.columns.forEach(column => {
            const columnEl = document.createElement('div');
            columnEl.className = 'kanban-column';
            columnEl.style.cssText = `
                flex: 0 0 auto;
                min-width: 300px;
                max-width: 400px;
                display: flex;
                flex-direction: column;
                background-color: var(--b3-theme-surface);
                border-radius: 8px;
                overflow: hidden;
            `;

            const header = document.createElement('div');
            header.className = 'kanban-column-header';
            header.style.cssText = `
                padding: 12px;
                border-bottom: 1px solid var(--b3-theme-background);
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: space-between;
            `;
            header.textContent = `${column.name} (${column.tasks.length})`;
            columnEl.appendChild(header);

            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'kanban-tasks';
            tasksContainer.style.cssText = `
                padding: 8px;
                min-height: 100px;
            `;

            column.tasks.forEach(task => {
                const taskEl = this.createTaskElement(task);
                tasksContainer.appendChild(taskEl);
            });

            if (column.tasks) {
                task
            }

            columnEl.appendChild(tasksContainer);
            kanbanContainer.appendChild(columnEl);
        });
    }

    private createTaskElement(task: PersonTask): HTMLElement {
        const taskEl = document.createElement('div');
        taskEl.className = 'kanban-task-item';
        taskEl.dataset.taskId = task.id;
        taskEl.draggable = true;

        const priorityColors = {
            'high': 'var(--b3-font-color13)',
            'medium': 'var(--b3-font-color14)',
            'low': 'var(--b3-font-color15)',
            'none': 'var(--b3-theme-on-surface)'
        };

        const priorityColor = priorityColors[task.priority] || priorityColors['none'];

        taskEl.style.cssText = `
            background-color: var(--b3-theme-background);
            border-left: 3px solid ${priorityColor};
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        const title = document.createElement('div');
        title.className = 'task-title';
        title.textContent = task.title;
        title.style.cssText = `
            font-weight: 500;
            margin-bottom: 4px;
            word-break: break-word;
        `;
        taskEl.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'task-meta';
        meta.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--b3-theme-on-surface-light);
            flex-wrap: wrap;
        `;

        if (task.date) {
            const dateEl = document.createElement('span');
            dateEl.textContent = task.date;
            meta.appendChild(dateEl);
        }

        if (task.projectId) {
            const projectEl = document.createElement('span');
            projectEl.textContent = '📂 ' + (task.projectName || '');
            meta.appendChild(projectEl);
        }

        if (task.pomodoroCount && task.pomodoroCount > 0) {
            const pomodoroEl = document.createElement('span');
            pomodoroEl.textContent = `🍅 ${task.pomodoroCount}`;
            meta.appendChild(pomodoroEl);
        }

        if (task.note) {
            const noteEl = document.createElement('div');
            noteEl.className = 'task-note';
            noteEl.textContent = task.note;
            noteEl.style.cssText = `
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
                margin-top: 6px;
                word-break: break-word;
            `;
            taskEl.appendChild(noteEl);
        }

        taskEl.appendChild(meta);

        taskEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openTask(task);
        });

        taskEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTaskMenu(e, task);
        });

        return taskEl;
    }

    private openTask(task: PersonTask) {
        if (task.blockId) {
            openBlock({ id: task.blockId });
        } else {
            showMessage(i18n('openNoteFailed') || '打开笔记失败');
        }
    }

    private showTaskMenu(event: MouseEvent, task: PersonTask) {
        const menu = new Menu("taskMenu");

        menu.addItem({
            label: i18n('openNote') || '打开笔记',
            click: () => this.openTask(task)
        });

        menu.addItem({
            label: i18n('markAsCompleted') || '标记为已完成',
            click: async () => {
                await this.markTaskCompleted(task);
            }
        });

        menu.addItem({
            label: i18n('setPriority') || '设置优先级',
            click: () => this.showPriorityMenu(event, task)
        });

        menu.open({
            x: event.clientX,
            y: event.clientY
        });
    }

    private async markTaskCompleted(task: PersonTask) {
        try {
            await this.plugin.updateReminderData((reminderData: any) => {
                if (reminderData && reminderData[task.id]) {
                    reminderData[task.id].completed = true;
                    reminderData[task.id].completedTime = getLocalDateTimeString(new Date());
                }
            });
            window.dispatchEvent(new CustomEvent('reminderUpdated', {
                detail: { source: 'personKanban' }
            }));
            showMessage(i18n('reminderUpdated') || '任务已更新');
        } catch (error) {
            console.error('标记任务完成失败:', error);
            showMessage(i18n('operationFailed') || '操作失败，请重试');
        }
    }

    private showPriorityMenu(event: MouseEvent, task: PersonTask) {
        const menu = new Menu("priorityMenu");

        const priorities = ['high', 'medium', 'low', 'none'] as const;
        priorities.forEach(priority => {
            const labels = {
                'high': i18n('highPriority') || '高优先级',
                'medium': i18n('mediumPriority') || '中优先级',
                'low': i18n('lowPriority') || '低优先级',
                'none': i18n('noPriority') || '无优先级'
            };
            menu.addItem({
                label: labels[priority],
                current: task.priority === priority,
                click: async () => {
                    await this.setTaskPriority(task, priority);
                }
            });
        });

        menu.open({
            x: event.clientX,
            y: event.clientY
        });
    }

    private async setTaskPriority(task: PersonTask, priority: string) {
        try {
            await this.plugin.updateReminderData((reminderData: any) => {
                if (reminderData && reminderData[task.id]) {
                    reminderData[task.id].priority = priority;
                }
            });
            window.dispatchEvent(new CustomEvent('reminderUpdated', {
                detail: { source: 'personKanban' }
            }));
            showMessage(i18n('prioritySet') || '优先级已设置', 2000, 'success');
        } catch (error) {
            console.error('设置优先级失败:', error);
            showMessage(i18n('operationFailed') || '操作失败，请重试');
        }
    }

    private showSortMenu(event: MouseEvent) {
        const menu = new Menu("sortMenu");

        const sortOptions = [
            { key: 'priority', label: i18n('sortByPriority') || '按优先级排序', icon: '🎯' },
            { key: 'time', label: i18n('sortByTime') || '按时间排序', icon: '🗓' },
            { key: 'title', label: i18n('sortByTitle') || '按标题排序', icon: '📝' }
        ];

        sortOptions.forEach(option => {
            menu.addItem({
                iconHTML: option.icon,
                label: `${option.label} (${i18n('descendingOrder') || '降序'})`,
                current: this.currentSort === option.key && this.currentSortOrder === 'desc',
                click: () => {
                    this.currentSort = option.key;
                    this.currentSortOrder = 'desc';
                    this.loadTasks();
                }
            });

            menu.addItem({
                iconHTML: option.icon,
                label: `${option.label} (${i18n('ascendingOrder') || '升序'})`,
                current: this.currentSort === option.key && this.currentSortOrder === 'asc',
                click: () => {
                    this.currentSort = option.key;
                    this.currentSortOrder = 'asc';
                    this.loadTasks();
                }
            });
        });

        menu.open({
            x: event.clientX,
            y: event.clientY
        });
    }

    private showDoneSortMenu(event: MouseEvent) {
        const menu = new Menu("doneSortMenu");

        menu.addItem({
            label: '按番茄钟数降序',
            current: this.doneSort === 'pomodoroCount' && this.doneSortOrder === 'desc',
            click: () => {
                this.doneSort = 'pomodoroCount';
                this.doneSortOrder = 'desc';
                this.loadTasks();
            }
        });

        menu.addItem({
            label: '按番茄钟数升序',
            current: this.doneSort === 'pomodoroCount' && this.doneSortOrder === 'asc',
            click: () => {
                this.doneSort = 'pomodoroCount';
                this.doneSortOrder = 'asc';
                this.loadTasks();
            }
        });

        menu.open({
            x: event.clientX,
            y: event.clientY
        });
    }

    private updateCategoryFilterButtonText() {
        if (!this.categoryFilterButton) return;

        if (this.selectedCategories.length === 0 || this.selectedCategories.includes('all')) {
            this.categoryFilterButton.textContent = i18n('categoryFilter') || '分类筛选';
        } else {
            const names = this.selectedCategories.map(id => {
                if (id === 'none') return i18n('noCategory') || '无分类';
                const cat = this.categoryManager.getCategoryById(id);
                return cat ? cat.name : id;
            });
            this.categoryFilterButton.textContent = names.join(', ');
        }
    }

    private async showCategorySelectDialog() {
        const categories = await this.categoryManager.loadCategories();

        const dialog = new Dialog({
            title: i18n('selectCategories') || '选择分类',
            content: this.createCategorySelectContent(categories),
            width: "400px",
            height: "250px"
        });

        const confirmBtn = dialog.element.querySelector('#categorySelectConfirm') as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector('#categorySelectCancel') as HTMLButtonElement;
        const allCheckbox = dialog.element.querySelector('#categoryAll') as HTMLInputElement;
        const checkboxes = dialog.element.querySelectorAll('.category-checkbox') as NodeListOf<HTMLInputElement>;

        allCheckbox.addEventListener('change', () => {
            if (allCheckbox.checked) {
                checkboxes.forEach(cb => cb.checked = false);
            }
        });

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    allCheckbox.checked = false;
                }
            });
        });

        confirmBtn.addEventListener('click', () => {
            const selected = [];
            if (allCheckbox.checked) {
                selected.push('all');
            } else {
                checkboxes.forEach(cb => {
                    if (cb.checked) {
                        selected.push(cb.value);
                    }
                });
            }
            this.selectedCategories = selected;
            this.updateCategoryFilterButtonText();
            this.loadTasks();
            dialog.destroy();
        });

        cancelBtn.addEventListener('click', () => dialog.destroy());
    }

    private createCategorySelectContent(categories: any[]): string {
        let html = `
            <div class="category-select-dialog">
                <div class="b3-dialog__content">
                    <div class="category-option">
                        <label>
                            <input type="checkbox" id="categoryAll" value="all" ${this.selectedCategories.includes('all') || this.selectedCategories.length === 0 ? 'checked' : ''}>
                            ${i18n('allCategories') || '全部分类'}
                        </label>
                    </div>
                    <div class="category-option">
                        <label>
                            <input type="checkbox" class="category-checkbox" value="none" ${this.selectedCategories.includes('none') ? 'checked' : ''}>
                            ${i18n('noCategory') || '无分类'}
                        </label>
                    </div>
        `;

        categories.forEach(cat => {
            html += `
                <div class="category-option">
                    <label>
                        <input type="checkbox" class="category-checkbox" value="${cat.id}" ${this.selectedCategories.includes(cat.id) ? 'checked' : ''}>
                        ${cat.icon() || ''} ${cat.name}
                    </label>
                </div>
            `;
        });

        html += `
                </div>
                <div class="b3-dialog__action">
                    <button class="b3-button b3-button--cancel" id="categorySelectCancel">${i18n('cancel') || '取消'}</button>
                    <button class="b3-button b3-button--primary" id="categorySelectConfirm">${i18n('confirm') || '确定'}</button>
                </div>
            </div>
        `;

        return html;
    }

    public destroy() {
        window.removeEventListener('reminderUpdated', this.reminderUpdatedHandler);
        this.pomodoroManager.cleanupInactiveTimer();
    }
}
