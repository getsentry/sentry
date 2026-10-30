import type {FocusTrap} from 'focus-trap';
import {createStore} from 'zustand';

import type {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';

export type ModalRenderer = (renderProps: ModalRenderProps) => React.ReactNode;

type State = {
  options: ModalOptions;
  renderer: ModalRenderer | null;
  triggerElement: HTMLElement | null;
  focusTrap?: FocusTrap;
};

const store = createStore<State>()(() => ({
  renderer: null,
  options: {},
  triggerElement: null,
}));

export function isModalOpen(state: Pick<State, 'renderer'>): boolean {
  return state.renderer !== null;
}

export const ModalStore = {
  ...store,

  reset() {
    store.setState({renderer: null, options: {}, triggerElement: null});
  },

  closeModal() {
    ModalStore.reset();
  },

  openModal(renderer: ModalRenderer, options: ModalOptions) {
    const triggerElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    store.setState({renderer, options, triggerElement});
  },

  setFocusTrap(focusTrap: FocusTrap) {
    store.setState({focusTrap});
  },
};
