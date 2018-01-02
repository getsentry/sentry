import Reflux from 'reflux';

import SudoActions from '../actions/sudoActions';

const SudoModalStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(SudoActions.closeModal, this.onCloseModal);
    this.listenTo(SudoActions.openModal, this.onOpenModal);
  },

  reset() {
    this.modalProps = null;
  },

  onCloseModal() {
    this.modalProps = null;
    this.trigger(this.modalProps);
  },

  onOpenModal(props) {
    this.modalProps = props;
    this.trigger(this.modalProps);
  },
});

export default SudoModalStore;
