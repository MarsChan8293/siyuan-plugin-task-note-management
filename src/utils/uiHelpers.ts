import { PersonManager } from "./personManager";

export function createAssigneeElement(personManager: PersonManager, assigneeId: string): HTMLElement | null {
    if (!assigneeId) return null;
    
    const personName = personManager.getPersonName(assigneeId);
    if (!personName) return null;

    const assigneeEl = document.createElement('div');
    assigneeEl.className = 'assignee-display';
    assigneeEl.style.cssText = `
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
    `;
    assigneeEl.innerHTML = `<svg style="width: 14px; height: 14px; opacity: 0.7;"><use xlink:href="#iconUser"></use></svg><span>${personName}</span>`;
    return assigneeEl;
}
