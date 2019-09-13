import Reflux from 'reflux';

import ModalActions, {ModalOptions} from 'app/actions/modalActions';
import {RenderProps} from 'app/components/globalModal';

type Renderer = (renderProps: RenderProps) => React.ReactNode;

type ModalStoreState = {
  renderer: Renderer | null;
  options: ModalOptions;
};

const ModalStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(ModalActions.closeModal, this.onCloseModal);
    this.listenTo(ModalActions.openModal, this.onOpenModal);
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
});

export default ModalStore;
