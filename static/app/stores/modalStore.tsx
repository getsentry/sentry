import Reflux from 'reflux';

import {ModalOptions, ModalRenderProps} from 'sentry/actionCreators/modal';
import ModalActions from 'sentry/actions/modalActions';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type ModalStoreState = {
  options: ModalOptions;
  renderer: Renderer | null;
};

type ModalStoreInterface = {
  get(): ModalStoreState;
  init(): void;
  onCloseModal(): void;
  onOpenModal(renderer: Renderer, options: ModalOptions): void;
  reset(): void;
};

const storeConfig: Reflux.StoreDefinition & ModalStoreInterface = {
  init() {
    this.reset();
    this.listenTo(ModalActions.closeModal, this.onCloseModal);
    this.listenTo(ModalActions.openModal, this.onOpenModal);
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

const ModalStore = Reflux.createStore(storeConfig) as Reflux.Store & ModalStoreInterface;

export default ModalStore;
