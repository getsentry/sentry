import {createStore, StoreDefinition} from 'reflux';

import {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type ModalStoreState = {
  options: ModalOptions;
  renderer: Renderer | null;
};

interface ModalStoreDefinition extends StoreDefinition {
  closeModal(): void;
  get(): ModalStoreState;
  init(): void;
  openModal(renderer: Renderer, options: ModalOptions): void;
  reset(): void;
}

const storeConfig: ModalStoreDefinition = {
  unsubscribeListeners: [],

  init() {
    this.reset();
  },

  get() {
    return this.state;
  },

  reset() {
    this.state = {
      renderer: null,
      options: {},
    } as ModalStoreState;
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

const ModalStore = createStore(makeSafeRefluxStore(storeConfig));
export default ModalStore;
