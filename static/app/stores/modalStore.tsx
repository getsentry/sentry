import type {FocusTrap} from 'focus-trap';
import {createStore} from 'zustand';

import type {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type State = {
  options: ModalOptions;
  renderer: Renderer | null;
  focusTrap?: FocusTrap;
  triggerElement?: HTMLElement | null;
};

const store = createStore<State>()(() => ({renderer: null, options: {}}));

export const ModalStore = {
  ...store,

  init() {
    ModalStore.reset();
  },

  reset() {
    store.setState({renderer: null, options: {}, triggerElement: undefined});
  },

  closeModal() {
    ModalStore.reset();
  },

  openModal(renderer: Renderer, options: ModalOptions) {
    const triggerElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    store.setState({renderer, options, triggerElement});
  },

  setFocusTrap(focusTrap: FocusTrap) {
    store.setState({focusTrap});
  },
};
