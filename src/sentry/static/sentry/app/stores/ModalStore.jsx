import Reflux from 'reflux';

import ModalActions from 'app/actions/modalActions';

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
    };
  },

  onCloseModal() {
    this.reset();
    this.trigger(this.state);
  },

  onOpenModal(renderer, options) {
    this.state = {renderer, options};
    this.trigger(this.state);
  },
});

export default ModalStore;
