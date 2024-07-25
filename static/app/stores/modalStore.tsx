import type {FocusTrap} from 'focus-trap';
import {createStore} from 'reflux';

import type {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';

import type {StrictStoreDefinition} from './types';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type State = {
  options: ModalOptions;
  pauseFocusTrap: (() => FocusTrap) | null;
  renderer: Renderer | null;
  unpauseFocusTrap: (() => FocusTrap) | null;
};

interface ModalStoreDefinition extends StrictStoreDefinition<State> {
  closeModal(): void;
  init(): void;
  openModal(renderer: Renderer, options: ModalOptions): void;
  reset(): void;
  setPauseFocusTrap(fx: State['pauseFocusTrap'] | null): void;
  setUnpauseFocusTrap(fx: State['unpauseFocusTrap'] | null): void;
}

const storeConfig: ModalStoreDefinition = {
  state: {renderer: null, options: {}, pauseFocusTrap: null, unpauseFocusTrap: null},
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  getState() {
    return this.state;
  },

  reset() {
    this.state = {
      ...this.state,
      renderer: null,
      options: {},
    };
  },

  closeModal() {
    this.reset();
    this.trigger(this.state);
  },

  openModal(renderer: Renderer, options: ModalOptions) {
    this.state = {...this.state, renderer, options};
    this.trigger(this.state);
  },

  setPauseFocusTrap(fx: State['pauseFocusTrap'] | null) {
    this.state = {
      ...this.state,
      pauseFocusTrap: fx,
    };
  },

  setUnpauseFocusTrap(fx: State['unpauseFocusTrap'] | null) {
    this.state = {
      ...this.state,
      unpauseFocusTrap: fx,
    };
  },
};

const ModalStore = createStore(storeConfig);
export default ModalStore;
