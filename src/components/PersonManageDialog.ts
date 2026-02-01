import { Dialog, showMessage, confirm } from "siyuan";
import { PersonManager } from "../utils/personManager";
import { i18n } from "../pluginInstance";

export class PersonManageDialog {
    private dialog: Dialog;
    private personManager: PersonManager;
    private onUpdated?: () => void;
    private plugin?: any;

    constructor(plugin?: any, onUpdated?: () => void) {
        this.plugin = plugin;
        this.personManager = PersonManager.getInstance(this.plugin);
        this.onUpdated = onUpdated;
    }

    public show() {
        this.dialog = new Dialog({
            title: i18n("personManagement"),
            content: this.createDialogContent(),
            width: "500px",
            height: "600px"
        });

        this.bindEvents();
        this.renderPersons();
    }

    private createDialogContent(): string {
        return `
            <div class="person-manage-dialog">
                <div class="b3-dialog__content">
                    <div class="person-toolbar">
                        <button class="b3-button b3-button--primary" id="addPersonBtn">
                            <svg class="b3-button__icon"><use xlink:href="#iconAdd"></use></svg>
                            ${i18n("addPerson")}
                        </button>
                    </div>
                    <div class="persons-list" id="personsList">
                    </div>
                </div>
                <div class="b3-dialog__action">
                    <button class="b3-button b3-button--primary" id="closeBtn">${i18n("save")}</button>
                </div>
            </div>
            <style>
                .person-manage-dialog {
                    max-height: 580px;
                }
                
                .person-toolbar {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .persons-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .person-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    background: var(--b3-theme-surface);
                    border: 1px solid var(--b3-border-color);
                    border-radius: 6px;
                }
                
                .person-item:hover {
                    background: var(--b3-theme-surface-lighter);
                }
                
                .person-info {
                    display: flex;
                    align-items: center;
                    flex: 1;
                }
                
                .person-name {
                    font-weight: 500;
                    color: var(--b3-theme-on-surface);
                }
                
                .person-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .person-actions button {
                    padding: 4px 8px;
                    font-size: 12px;
                }
                
                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--b3-theme-on-surface);
                    opacity: 0.6;
                }
            </style>
        `;
    }

    private bindEvents() {
        const addBtn = this.dialog.element.querySelector('#addPersonBtn') as HTMLButtonElement;
        const closeBtn = this.dialog.element.querySelector('#closeBtn') as HTMLButtonElement;

        addBtn.addEventListener('click', () => this.showAddPersonDialog());
        closeBtn.addEventListener('click', () => {
            if (this.onUpdated) {
                this.onUpdated();
            }
            this.dialog.destroy();
        });
    }

    private renderPersons() {
        const listElement = this.dialog.element.querySelector('#personsList') as HTMLElement;
        const persons = this.personManager.getPersons();

        if (persons.length === 0) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <p>${i18n("noPersons")}</p>
                    <p style="font-size: 12px; margin-top: 8px;">${i18n("clickAddPerson")}</p>
                </div>
            `;
            return;
        }

        listElement.innerHTML = persons.map(person => `
            <div class="person-item" data-id="${person.id}">
                <div class="person-info">
                    <span class="person-name">${this.escapeHtml(person.name)}</span>
                </div>
                <div class="person-actions">
                    <button class="b3-button b3-button--text" id="edit-${person.id}">
                        ${i18n("editPerson")}
                    </button>
                    <button class="b3-button b3-button--text" id="delete-${person.id}" style="color: var(--b3-theme-error);">
                        ${i18n("deletePerson")}
                    </button>
                </div>
            </div>
        `).join('');

        persons.forEach(person => {
            const editBtn = this.dialog.element.querySelector(`#edit-${person.id}`) as HTMLButtonElement;
            const deleteBtn = this.dialog.element.querySelector(`#delete-${person.id}`) as HTMLButtonElement;

            editBtn.addEventListener('click', () => this.showEditPersonDialog(person));
            deleteBtn.addEventListener('click', () => this.deletePerson(person.id));
        });
    }

    private async showAddPersonDialog() {
        const name = prompt(i18n("personName") || "责任人姓名");
        if (!name) {
            return;
        }

        try {
            await this.personManager.addPerson(name);
            showMessage(i18n("personCreatedSuccessfully") || "责任人创建成功");
            this.renderPersons();
        } catch (error: any) {
            console.error('添加责任人失败:', error);
            showMessage(error.message || i18n("operationFailed") || "操作失败", 3000, 'error');
        }
    }

    private async showEditPersonDialog(person: any) {
        const newName = prompt(i18n("personName") || "责任人姓名", person.name);
        if (newName === null) {
            return;
        }

        try {
            await this.personManager.updatePerson(person.id, { name: newName });
            showMessage(i18n("personUpdatedSuccessfully") || "责任人更新成功");
            this.renderPersons();
        } catch (error: any) {
            console.error('更新责任人失败:', error);
            showMessage(error.message || i18n("operationFailed") || "操作失败", 3000, 'error');
        }
    }

    private async deletePerson(personId: string) {
        const usage = await this.personManager.checkPersonInUse(personId);
        
        if (usage.inUse) {
            const msg = i18n("personInUseWarning") || "该责任人已被分配给{0}个任务和{1}个项目，请先解除分配。";
            const formattedMsg = msg.replace('{0}', usage.tasksCount.toString()).replace('{1}', usage.projectsCount.toString());
            showMessage(formattedMsg, 5000, 'error');
            return;
        }

        confirm(
            i18n("deletePerson") || "删除责任人",
            i18n("confirmDeletePerson") || "确定要删除此责任人吗？",
            async () => {
                try {
                    await this.personManager.deletePerson(personId);
                    showMessage(i18n("personDeletedSuccessfully") || "责任人删除成功");
                    this.renderPersons();
                } catch (error) {
                    console.error('删除责任人失败:', error);
                    showMessage(i18n("operationFailed") || "操作失败", 3000, 'error');
                }
            }
        );
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
