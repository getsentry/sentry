import Reflux from 'reflux';

import {ModalOptions, ModalRenderProps} from 'app/actionCreators/modal';
import ModalActions from 'app/actions/modalActions';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

type ModalStoreState = {
  renderer: Renderer | null;
  options: ModalOptions;
};

type ModalStoreInterface = {
  init: () => void;
  get: () => ModalStoreState;
  reset: () => void;
  onCloseModal: () => void;
  onOpenModal: (renderer: Renderer, options: ModalOptions) => void;
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

type ModalStore = Reflux.Store & ModalStoreInterface;

const ModalStore = Reflux.createStore(storeConfig) as ModalStore;

export default ModalStore;
