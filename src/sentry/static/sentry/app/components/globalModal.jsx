import Modal from 'react-bootstrap/lib/Modal';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {closeModal} from 'app/actionCreators/modal';
import Confirm from 'app/components/confirm';
import ModalStore from 'app/stores/modalStore';

class GlobalModal extends React.Component {
  static propTypes = {
    /**
     * Needs to be a function that returns a React Element
     * Function is injected with:
     * Modal `Header`, `Body`, and `Footer,
     * `closeModal`
     *
     */
    children: PropTypes.func,
    options: PropTypes.shape({
      onClose: PropTypes.func,
      modalClassName: PropTypes.string,
    }),
    visible: PropTypes.bool,
    /**
     * Note this is the callback for the main App container and
     * NOT the calling component.  GlobalModal is never used directly,
     * but is controlled via stores. To access the onClose callback from
     * the component, you must specify it when using the action creator.
     */
    onClose: PropTypes.func,
  };

  static defaultProps = {
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
    let Component = Modal;

    if (options && options.type === 'confirm') {
      Component = Confirm;
    }

    return (
      <Component
        className={options && options.modalClassName}
        show={visible}
        animation={false}
        onHide={this.handleCloseModal}
      >
        {children
          ? children({
              closeModal,
              Header: Modal.Header,
              Body: Modal.Body,
              Footer: Modal.Footer,
            })
          : null}
      </Component>
    );
  }
}

const GlobalModalContainer = createReactClass({
  displayName: 'GlobalModalContainer',
  mixins: [Reflux.connect(ModalStore, 'modalStore')],

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
