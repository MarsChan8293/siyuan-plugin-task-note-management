import { Dialog } from "siyuan";
import { PersonManager } from "../utils/personManager";
import { i18n } from "../pluginInstance";

export class PersonSelectDialog {
    private dialog: Dialog;
    private personManager: PersonManager;
    private onSelected?: (personId: string | null) => void;
    private selectedPersonId: string | null;
    private plugin?: any;
    private searchQuery: string = '';

    constructor(plugin?: any, currentPersonId?: string, onSelected?: (personId: string | null) => void) {
        this.plugin = plugin;
        this.personManager = PersonManager.getInstance(this.plugin);
        this.selectedPersonId = currentPersonId || null;
        this.onSelected = onSelected;
    }

    public show() {
        this.dialog = new Dialog({
            title: i18n("selectAssignee"),
            content: this.createDialogContent(),
            width: "400px",
            height: "500px"
        });

        this.bindEvents();
        this.renderPersons();
    }

    private createDialogContent(): string {
        return `
            <div class="person-select-dialog">
                <div class="b3-dialog__content">
                    <div class="search-box">
                        <input type="text" 
                               id="personSearch" 
                               placeholder="${i18n("search") || "搜索..."}"
                               value="${this.escapeHtml(this.searchQuery)}"
                               class="b3-text-field fn__flex-center">
                    </div>
                    <div class="persons-list" id="personsList">
                    </div>
                </div>
                <div class="b3-dialog__action">
                    <button class="b3-button" id="cancelBtn">${i18n("cancel")}</button>
                    <button class="b3-button b3-button--primary" id="confirmBtn">${i18n("confirm")}</button>
                </div>
            </div>
            <style>
                .person-select-dialog {
                    max-height: 480px;
                }
                
                .search-box {
                    margin-bottom: 16px;
                }
                
                .search-box input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--b3-border-color);
                    border-radius: 4px;
                    background: var(--b3-theme-surface);
                    color: var(--b3-theme-on-surface);
                }
                
                .search-box input:focus {
                    outline: none;
                    border-color: var(--b3-theme-primary);
                }
                
                .persons-list {
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .person-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    background: var(--b3-theme-surface);
                    border: 1px solid var(--b3-border-color);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .person-item:hover {
                    background: var(--b3-theme-surface-lighter);
                }
                
                .person-item.selected {
                    background: var(--b3-theme-primary-lighter);
                    border-color: var(--b3-theme-primary);
                }
                
                .person-radio {
                    margin-right: 12px;
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }
                
                .person-name {
                    flex: 1;
                    font-weight: 500;
                    color: var(--b3-theme-on-surface);
                }
                
                .no-person-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    background: var(--b3-theme-surface);
                    border: 1px solid var(--b3-border-color);
                    border-radius: 6px;
                    cursor: pointer;
                }
                
                .no-person-item:hover {
                    background: var(--b3-theme-surface-lighter);
                }
                
                .no-person-item.selected {
                    background: var(--b3-theme-primary-lighter);
                    border-color: var(--b3-theme-primary);
                }
                
                .no-person-label {
                    flex: 1;
                    color: var(--b3-theme-on-surface);
                    opacity: 0.7;
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
        const searchInput = this.dialog.element.querySelector('#personSearch') as HTMLInputElement;
        const confirmBtn = this.dialog.element.querySelector('#confirmBtn') as HTMLButtonElement;
        const cancelBtn = this.dialog.element.querySelector('#cancelBtn') as HTMLButtonElement;
        const personsList = this.dialog.element.querySelector('#personsList') as HTMLElement;

        searchInput.addEventListener('input', (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value;
            this.renderPersons();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const firstPersonItem = personsList.querySelector('.person-item, .no-person-item') as HTMLElement;
                if (firstPersonItem) {
                    firstPersonItem.focus();
                }
            }
        });

        confirmBtn.addEventListener('click', () => {
            if (this.onSelected) {
                this.onSelected(this.selectedPersonId);
            }
            this.dialog.destroy();
        });

        cancelBtn.addEventListener('click', () => {
            this.dialog.destroy();
        });

        this.dialog.element.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.dialog.destroy();
            } else if (e.key === 'Enter' && !(e.target as HTMLElement)?.matches('input[type="text"]')) {
                if (this.onSelected) {
                    this.onSelected(this.selectedPersonId);
                }
                this.dialog.destroy();
            }
        });

        personsList.addEventListener('keydown', (e) => {
            const items = Array.from(personsList.querySelectorAll('.person-item, .no-person-item'));
            const currentIndex = items.findIndex(item => item === document.activeElement);
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                (items[prevIndex] as HTMLElement).focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                (items[nextIndex] as HTMLElement).focus();
            }
        });
    }

    private renderPersons() {
        const listElement = this.dialog.element.querySelector('#personsList') as HTMLElement;
        let persons = this.personManager.getPersons();

        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            persons = persons.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.id.toLowerCase().includes(query)
            );
        }

        let html = `
            <div class="no-person-item ${this.selectedPersonId === null ? 'selected' : ''}" data-id="" tabindex="0">
                <input type="radio" class="person-radio" 
                       name="person" 
                       ${this.selectedPersonId === null ? 'checked' : ''}
                       value="">
                <span class="no-person-label">${i18n("noAssignee")}</span>
            </div>
        `;

        if (persons.length === 0 && this.searchQuery) {
            html += `
                <div class="empty-state">
                    <div>没有找到匹配的人员</div>
                </div>
            `;
        } else {
            html += persons.map(person => `
                <div class="person-item ${this.selectedPersonId === person.id ? 'selected' : ''}" data-id="${person.id}" tabindex="0">
                    <input type="radio" class="person-radio" 
                           name="person" 
                           ${this.selectedPersonId === person.id ? 'checked' : ''}
                           value="${person.id}">
                    <span class="person-name">${this.escapeHtml(person.name)}</span>
                </div>
            `).join('');
        }

        listElement.innerHTML = html;

        const noPersonItem = listElement.querySelector('.no-person-item') as HTMLElement;
        noPersonItem?.addEventListener('click', () => {
            this.selectedPersonId = null;
            this.updateSelection();
        });

        persons.forEach(person => {
            const personItem = listElement.querySelector(`.person-item[data-id="${person.id}"]`) as HTMLElement;
            personItem?.addEventListener('click', () => {
                this.selectedPersonId = person.id;
                this.updateSelection();
            });
        });
    }

    private updateSelection() {
        const listElement = this.dialog.element.querySelector('#personsList') as HTMLElement;
        const selector = this.selectedPersonId === null 
            ? '.no-person-item' 
            : `.person-item[data-id="${this.selectedPersonId}"]`;
        
        listElement.querySelectorAll('.person-item, .no-person-item').forEach(item => {
            item.classList.remove('selected');
            const radio = item.querySelector('input[type="radio"]') as HTMLInputElement;
            if (radio) radio.checked = false;
        });

        const selectedItem = listElement.querySelector(selector) as HTMLElement;
        if (selectedItem) {
            selectedItem.classList.add('selected');
            const radio = selectedItem.querySelector('input[type="radio"]') as HTMLInputElement;
            if (radio) radio.checked = true;
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
