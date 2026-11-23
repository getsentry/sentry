import type {FocusTrap} from 'focus-trap';
import {createStore} from 'zustand/vanilla';

import type {ModalOptions, ModalRenderer} from './types';

interface ModalState {
  modalId: number;
  options: ModalOptions;
  renderer: ModalRenderer | null;
  triggerElement: HTMLElement | null;
  focusTrap?: FocusTrap;
}

export const modalStore = createStore<ModalState>()(() => ({
  modalId: 0,
  renderer: null,
  options: {},
  triggerElement: null,
}));

export function selectIsModalOpen(state: Pick<ModalState, 'renderer'>): boolean {
  return state.renderer !== null;
}

export function isModalOpen(): boolean {
  return selectIsModalOpen(modalStore.getState());
}

export function subscribeToModalOpen(listener: (isOpen: boolean) => void): () => void {
  return modalStore.subscribe((state, previous) => {
    const isOpen = selectIsModalOpen(state);
    if (isOpen !== selectIsModalOpen(previous)) {
      listener(isOpen);
    }
  });
}

export function openModal(renderer: ModalRenderer, options: ModalOptions = {}) {
  const triggerElement =
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  // Close the on-screen keyboard before the page is locked, so the dialog is
  // laid out for the full viewport instead of the area above the keyboard.
  if (
    triggerElement instanceof HTMLInputElement ||
    triggerElement instanceof HTMLTextAreaElement ||
    triggerElement?.isContentEditable
  ) {
    triggerElement.blur();
  }
  modalStore.setState(state => ({
    modalId: state.modalId + 1,
    renderer,
    options,
    triggerElement,
  }));
}

export function closeModal() {
  modalStore.setState({renderer: null, options: {}, triggerElement: null});
}

export function setFocusTrap(focusTrap: FocusTrap | undefined) {
  modalStore.setState({focusTrap});
}
