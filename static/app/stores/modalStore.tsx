import {Store} from '@tanstack/react-store';
import type {FocusTrap} from 'focus-trap';

import type {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type State = {
  options: ModalOptions;
  renderer: Renderer | null;
  focusTrap?: FocusTrap;
  triggerElement?: HTMLElement | null;
};

const store = new Store<State>({renderer: null, options: {}});

export const ModalStore = {
  store,

  getState() {
    return store.state;
  },

  init() {
    ModalStore.reset();
  },

  reset() {
    store.setState(prev => ({
      ...prev,
      renderer: null,
      options: {},
      triggerElement: undefined,
    }));
  },

  closeModal() {
    ModalStore.reset();
  },

  openModal(renderer: Renderer, options: ModalOptions) {
    const triggerElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    store.setState(prev => ({...prev, renderer, options, triggerElement}));
  },

  setFocusTrap(focusTrap: FocusTrap) {
    store.setState(prev => ({...prev, focusTrap}));
  },
};
