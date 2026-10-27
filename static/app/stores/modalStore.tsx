import type {FocusTrap} from 'focus-trap';

import type {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';
import {createLegacyStore} from 'sentry/stores/createLegacyStore';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type State = {
  options: ModalOptions;
  renderer: Renderer | null;
  focusTrap?: FocusTrap;
  triggerElement?: HTMLElement | null;
};

const store = createLegacyStore<State>({renderer: null, options: {}});

export const ModalStore = {
  ...store,

  init() {
    ModalStore.reset();
  },

  reset() {
    store.resetState({
      renderer: null,
      options: {},
      focusTrap: store.getState().focusTrap,
    });
  },

  closeModal() {
    store.setState(() => ({
      renderer: null,
      options: {},
      focusTrap: store.getState().focusTrap,
    }));
  },

  openModal(renderer: Renderer, options: ModalOptions) {
    const triggerElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    store.setState(() => ({
      renderer,
      options,
      focusTrap: store.getState().focusTrap,
      triggerElement,
    }));
  },

  setFocusTrap(focusTrap: FocusTrap) {
    store.resetState({...store.getState(), focusTrap});
  },
};
