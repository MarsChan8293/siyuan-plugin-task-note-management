import { PersonManager } from "./personManager";

export function updateAssigneeDisplay(
    element: HTMLElement, 
    assigneeId: string | null, 
    personManager: PersonManager,
    inputId: string,
    clearBtnId: string
) {
    const assigneeInput = element.querySelector(`#${inputId}`) as HTMLInputElement;
    const clearAssigneeBtn = element.querySelector(`#${clearBtnId}`) as HTMLButtonElement;

    if (assigneeInput) {
        assigneeInput.value = assigneeId ? personManager.getPersonName(assigneeId) || '' : '';
    }

    if (clearAssigneeBtn) {
        clearAssigneeBtn.style.display = assigneeId ? '' : 'none';
    }
}
