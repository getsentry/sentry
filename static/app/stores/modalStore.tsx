import {createStore, StoreDefinition} from 'reflux';

import {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';
import ModalActions from 'sentry/actions/modalActions';
import {makeSafeRefluxStore, SafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type ModalStoreState = {
  options: ModalOptions;
  renderer: Renderer | null;
};

interface ModalStoreDefinition extends StoreDefinition {
  get(): ModalStoreState;
  init(): void;
  onCloseModal(): void;
  onOpenModal(renderer: Renderer, options: ModalOptions): void;
  reset(): void;
}

const storeConfig: ModalStoreDefinition = {
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(
      this.listenTo(ModalActions.closeModal, this.onCloseModal)
    );
    this.unsubscribeListeners.push(
      this.listenTo(ModalActions.openModal, this.onOpenModal)
    );
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

  onCloseModal() {
    this.reset();
    this.trigger(this.state);
  },

  onOpenModal(renderer: Renderer, options: ModalOptions) {
    this.state = {renderer, options};
    this.trigger(this.state);
  },
};

const ModalStore = createStore(makeSafeRefluxStore(storeConfig)) as SafeRefluxStore &
  ModalStoreDefinition;

export default ModalStore;
