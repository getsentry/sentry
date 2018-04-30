import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import Button from 'app/components/buttons/button';
import {t} from 'app/locale';

class Confirm extends React.PureComponent {
  static propTypes = {
    onConfirm: PropTypes.func.isRequired,
    confirmText: PropTypes.string.isRequired,
    cancelText: PropTypes.string.isRequired,
    priority: PropTypes.oneOf(['primary', 'danger']).isRequired,
    /**
     * If true, will skip the confirmation modal and call `onConfirm`
     */
    bypass: PropTypes.bool,
    message: PropTypes.node,
    /**
     * Renderer that passes:
     * `confirm`: Allows renderer to perform confirm action
     * `close`: Allows renderer to toggle confirm modal
     */
    renderMessage: PropTypes.func,

    disabled: PropTypes.bool,
    onConfirming: PropTypes.func,
    onCancel: PropTypes.func,
  };

  static defaultProps = {
    priority: 'primary',
    cancelText: t('Cancel'),
    confirmText: t('Confirm'),
  };

  constructor(...args) {
    super(...args);

    this.state = {
      isModalOpen: false,
      disableConfirmButton: false,
    };
    this.confirming = false;
  }

  openModal = () => {
    let {onConfirming} = this.props;
    if (typeof onConfirming === 'function') {
      onConfirming();
    }

    this.setState(state => ({
      isModalOpen: true,
      disableConfirmButton: false,
    }));

    // always reset `confirming` when modal visibility changes
    this.confirming = false;
  };

  closeModal = () => {
    let {onCancel} = this.props;
    if (typeof onCancel === 'function') {
      onCancel();
    }
    this.setState(state => ({
      isModalOpen: false,
      disableConfirmButton: false,
    }));

    // always reset `confirming` when modal visibility changes
    this.confirming = false;
  };

  handleConfirm = e => {
    // `confirming` is used to make sure `onConfirm` is only called once
    if (!this.confirming) {
      this.props.onConfirm();
    }

    // Close modal
    this.setState({
      isModalOpen: false,
      disableConfirmButton: true,
    });
    this.confirming = true;
  };

  handleToggle = e => {
    let {disabled, bypass} = this.props;
    if (disabled) return;

    if (bypass) {
      this.props.onConfirm();
      return;
    }

    // Current state is closed, means it will toggle open
    if (!this.state.isModalOpen) {
      this.openModal();
    } else {
      this.closeModal();
    }
  };

  render() {
    let {
      disabled,
      message,
      renderMessage,
      priority,
      confirmText,
      cancelText,
      children,
    } = this.props;

    let confirmMessage;
    if (typeof renderMessage === 'function') {
      confirmMessage = renderMessage({
        confirm: this.handleConfirm,
        close: this.handleToggle,
      });
    } else {
      confirmMessage = React.isValidElement(message) ? (
        message
      ) : (
        <p>
          <strong>{message}</strong>
        </p>
      );
    }

    return (
      <React.Fragment>
        {typeof children === 'function'
          ? children({
              close: this.closeModal,
              open: this.openModal,
            })
          : React.cloneElement(children, {disabled, onClick: this.handleToggle})}
        <Modal show={this.state.isModalOpen} animation={false} onHide={this.handleToggle}>
          <div className="modal-body">{confirmMessage}</div>
          <div className="modal-footer">
            <Button style={{marginRight: 10}} onClick={this.handleToggle}>
              {cancelText}
            </Button>
            <Button
              data-test-id="confirm-modal"
              disabled={this.state.disableConfirmButton}
              priority={priority}
              onClick={this.handleConfirm}
              autoFocus
            >
              {confirmText}
            </Button>
          </div>
        </Modal>
      </React.Fragment>
    );
  }
}

export default Confirm;
