import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import Button from 'app/components/button';
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
    disableConfirmButton: PropTypes.bool,
    onConfirming: PropTypes.func,
    onCancel: PropTypes.func,
    header: PropTypes.node,
  };

  static defaultProps = {
    priority: 'primary',
    disableConfirmButton: false,
    cancelText: t('Cancel'),
    confirmText: t('Confirm'),
  };

  static getDerivedStateFromProps(props, state) {
    // Reset the state to handle prop changes from ConfirmDelete
    if (props.disableConfirmButton !== state.disableConfirmButton) {
      return {
        disableConfirmButton: props.disableConfirmButton,
      };
    }
    return null;
  }

  constructor(props) {
    super(props);

    this.state = {
      isModalOpen: false,
      disableConfirmButton: props.disableConfirmButton,
    };
    this.confirming = false;
  }

  openModal = () => {
    const {onConfirming, disableConfirmButton} = this.props;
    if (typeof onConfirming === 'function') {
      onConfirming();
    }

    this.setState(state => ({
      isModalOpen: true,
      disableConfirmButton,
    }));

    // always reset `confirming` when modal visibility changes
    this.confirming = false;
  };

  closeModal = () => {
    const {onCancel, disableConfirmButton} = this.props;
    if (typeof onCancel === 'function') {
      onCancel();
    }
    this.setState(state => ({
      isModalOpen: false,
      disableConfirmButton,
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
    const {disabled, bypass} = this.props;
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
    const {
      disabled,
      message,
      renderMessage,
      priority,
      confirmText,
      cancelText,
      children,
      header,
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
          : React.cloneElement(children, {
              disabled,
              onClick: this.handleToggle,
            })}
        <Modal show={this.state.isModalOpen} animation={false} onHide={this.handleToggle}>
          {header && <div className="modal-header">{header}</div>}
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
