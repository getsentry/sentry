import Reflux from 'reflux';

export default Reflux.createActions(['openModal', 'closeModal']);

export type ModalOptions = {
  onClose?: () => void;
  modalClassName?: string;
  type?: string;
};
