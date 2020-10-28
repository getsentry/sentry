import Reflux from 'reflux';

import ModalActions from 'app/actions/modalActions';
import {ModalRenderProps, ModalOptions} from 'app/actionCreators/modal';

type Renderer = (renderProps: ModalRenderProps) => React.ReactNode;

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
    const onClose = this.state?.options?.onClose;

    // Trigger the options.onClose callback
    if (typeof onClose === 'function') {
      onClose();
    }

    this.reset();
    this.trigger(this.state);
  },

  onOpenModal(renderer: Renderer, options: ModalOptions) {
    this.state = {renderer, options};
    this.trigger(this.state);
  },
});

// TODO(ts): This should be properly typed
export default ModalStore as any;
