import React from 'react';
import Modal from 'react-modal';
import {browserHistory} from 'react-router';
import {ClassNames, css as emotionCss} from '@emotion/core';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {closeModal} from 'app/actionCreators/modal';
import Confirm from 'app/components/confirm';
import ModalStore from 'app/stores/modalStore';
import theme from 'app/utils/theme';

export type ModalRenderProps = {
  closeModal: () => void;
  Header: React.ComponentType<any>;
  Body: React.ComponentType<any>;
  Footer: React.ComponentType<any>;
};

export type ModalOptions = {
  onClose?: () => void;
  modalCss?: ReturnType<typeof emotionCss>;
  modalClassName?: string;
  dialogClassName?: string;
  type?: string;
};

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

    // Read description in propTypes
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  render() {
    const {visible, children, options} = this.props;
    const renderedChild =
      typeof children === 'function'
        ? children({
            closeModal,
            Header: p => p.children,
            Body: p => p.children,
            Footer: p => p.children,
          })
        : undefined;

    if (options && options.type === 'confirm') {
      return <Confirm onConfirm={() => {}}>{() => renderedChild}</Confirm>;
    }

    return (
      <div className="modal">
        <ClassNames>
          {({css, cx}) => (
            <Modal
              bodyOpenClassName="modal-open"
              overlayClassName={css`
                background: rgba(0, 0, 0, 0.2);
                z-index: ${theme.zIndex.modal};
                height: 100vh;
                width: 100vw;
                position: fixed;
                top: 0;
                left: 0;
              `}
              className={cx(
                'modal-dialog',
                options?.modalClassName,
                options?.dialogClassName,
                options?.modalCss && css(options.modalCss),
                css`
                  outline: none;
                `
              )}
              portalClassName="modal-portal"
              isOpen={visible}
              onRequestClose={this.handleCloseModal}
            >
              {renderedChild}
            </Modal>
          )}
        </ClassNames>
      </div>
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
