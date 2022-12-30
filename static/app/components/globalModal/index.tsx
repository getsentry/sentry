import {Component, ComponentProps} from 'react';

import {closeModal} from 'sentry/actionCreators/modal';
import Modal from 'sentry/components/modal';
import ModalStore from 'sentry/stores/modalStore';

type State = {
  modalStore: ReturnType<typeof ModalStore.getState>;
};

class GlobalModalContainer extends Component<
  Partial<ComponentProps<typeof Modal>>,
  State
> {
  state: State = {
    modalStore: ModalStore.getState(),
  };

  componentWillUnmount() {
    this.unlistener?.();
  }

  unlistener = ModalStore.listen(
    (modalStore: State['modalStore']) => this.setState({modalStore}),
    undefined
  );

  render() {
    const {modalStore} = this.state;
    const visible = !!modalStore && typeof modalStore.renderer === 'function';

    return (
      <Modal {...this.props} {...modalStore} onClose={closeModal} visible={visible}>
        {visible ? modalStore.renderer : null}
      </Modal>
    );
  }
}

export default GlobalModalContainer;
