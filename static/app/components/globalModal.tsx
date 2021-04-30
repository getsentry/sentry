import * as React from 'react';
// eslint-disable-next-line no-restricted-imports
import Modal from 'react-bootstrap/lib/Modal';
import {browserHistory} from 'react-router';
import {ClassNames} from '@emotion/react';

import {closeModal, ModalOptions, ModalRenderProps} from 'app/actionCreators/modal';
import Confirm from 'app/components/confirm';
import ModalStore from 'app/stores/modalStore';

type DefaultProps = {
  options: ModalOptions;
  visible: boolean;
};

type Props = DefaultProps & {
  /**
   * Needs to be a function that returns a React Element
   * Function is injected with:
   * Modal `Header`, `Body`, and `Footer`,
   * `closeModal`
   *
   */
  children?: null | ((renderProps: ModalRenderProps) => React.ReactNode);

  /**
   * Note this is the callback for the main App container and
   * NOT the calling component.  GlobalModal is never used directly,
   * but is controlled via stores. To access the onClose callback from
   * the component, you must specify it when using the action creator.
   */
  onClose?: () => void;
};

class GlobalModal extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    visible: false,
    options: {},
  };

  handleCloseModal = () => {
    const {options, onClose} = this.props;

    // onClose callback for calling component
    if (typeof options.onClose === 'function') {
      options.onClose();
    }

    // Action creator
    closeModal();

    if (typeof onClose === 'function') {
      onClose();
    }
  };

  render() {
    const {visible, children, options} = this.props;
    const renderedChild =
      typeof children === 'function'
        ? children({
            closeModal: this.handleCloseModal,
            Header: Modal.Header,
            Body: Modal.Body,
            Footer: Modal.Footer,
          })
        : undefined;

    if (options && options.type === 'confirm') {
      return <Confirm onConfirm={() => {}}>{() => renderedChild}</Confirm>;
    }

    return (
      <ClassNames>
        {({css, cx}) => (
          <Modal
            className={cx(
              options?.modalClassName,
              options?.modalCss && css(options.modalCss)
            )}
            dialogClassName={options && options.dialogClassName}
            show={visible}
            animation={false}
            onHide={this.handleCloseModal}
            backdrop={options?.backdrop}
          >
            {renderedChild}
          </Modal>
        )}
      </ClassNames>
    );
  }
}

type State = {
  modalStore: ReturnType<typeof ModalStore.get>;
};

class GlobalModalContainer extends React.Component<Partial<Props>, State> {
  state: State = {
    modalStore: ModalStore.get(),
  };

  componentDidMount() {
    // Listen for route changes so we can dismiss modal
    this.unlistenBrowserHistory = browserHistory.listen(() => closeModal());
  }

  componentWillUnmount() {
    this.unlistenBrowserHistory?.();
    this.unlistener?.();
  }

  unlistener = ModalStore.listen(
    (modalStore: State['modalStore']) => this.setState({modalStore}),
    undefined
  );

  unlistenBrowserHistory?: ReturnType<typeof browserHistory.listen>;

  render() {
    const {modalStore} = this.state;
    const visible = !!modalStore && typeof modalStore.renderer === 'function';

    return (
      <GlobalModal {...this.props} {...modalStore} visible={visible}>
        {visible ? modalStore.renderer : null}
      </GlobalModal>
    );
  }
}

export default GlobalModalContainer;
