import React from 'react';
// eslint-disable-next-line no-restricted-imports
import Modal from 'react-bootstrap/lib/Modal';
import {browserHistory} from 'react-router';
import {ClassNames} from '@emotion/core';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

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
  children?: (renderProps: ModalRenderProps) => React.ReactNode;

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

const GlobalModalContainer = createReactClass<Partial<Props>>({
  displayName: 'GlobalModalContainer',
  mixins: [Reflux.connect(ModalStore, 'modalStore') as any],

  getInitialState() {
    return {
      modalStore: {},
      error: false,
      busy: false,
    };
  },

  componentDidMount() {
    // Listen for route changes so we can dismiss modal
    this.unlistenBrowserHistory = browserHistory.listen(() => closeModal());
  },

  componentWillUnmount() {
    if (this.unlistenBrowserHistory) {
      this.unlistenBrowserHistory();
    }
  },

  render() {
    const {modalStore} = this.state;
    const visible = !!modalStore && typeof modalStore.renderer === 'function';

    return (
      <GlobalModal {...this.props} {...modalStore} visible={visible}>
        {visible ? modalStore.renderer : null}
      </GlobalModal>
    );
  },
});

export default GlobalModalContainer;
