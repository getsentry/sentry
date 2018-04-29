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
  };

  static defaultProps = {
    visible: false,
    options: {},
  };

  handleCloseModal = () => {
    let {options} = this.props;

    if (typeof options.onClose === 'function') {
      options.onClose();
    }

    // Focus this to get hotkeys to keep working
    let containerEl = document.querySelector('.main-container');
    if (containerEl) {
      containerEl.focus();
    }

    // Action creator
    closeModal();
  };

  render() {
    let {visible, children, options} = this.props;
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
    this.unlisten = browserHistory.listen(() => closeModal());
  },

  componentWillUnmount() {
    if (this.unlisten) {
      this.unlisten();
    }
  },

  render() {
    let {modalStore} = this.state;
    let visible = !!modalStore && typeof modalStore.renderer === 'function';

    return (
      <GlobalModal {...this.props} {...modalStore} visible={visible}>
        {visible ? modalStore.renderer : null}
      </GlobalModal>
    );
  },
});
export default GlobalModalContainer;
