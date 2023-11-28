import {createStore} from 'reflux';

import type {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';

import {CommonStoreDefinition} from './types';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type State = {
  options: ModalOptions;
  renderer: Renderer | null;
};

interface ModalStoreDefinition extends CommonStoreDefinition<State> {
  closeModal(): void;
  getState(): State;
  init(): void;
  openModal(renderer: Renderer, options: ModalOptions): void;
  reset(): void;
}

const storeConfig: ModalStoreDefinition = {
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
      renderer: null,
      options: {},
    } as State;
  },

  closeModal() {
    this.reset();
    this.trigger(this.state);
  },

  openModal(renderer: Renderer, options: ModalOptions) {
    this.state = {renderer, options};
    this.trigger(this.state);
  },
};

const ModalStore = createStore(storeConfig);
export default ModalStore;
