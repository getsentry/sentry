import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import Button from './buttons/button';

class Confirm extends React.PureComponent {
  static propTypes = {
    disabled: PropTypes.bool,
    message: PropTypes.node.isRequired,
    onConfirm: PropTypes.func.isRequired,
    onConfirming: PropTypes.func,
    onCancel: PropTypes.func,
    priority: PropTypes.oneOf(['primary', 'danger']).isRequired,
    confirmText: PropTypes.string.isRequired,
    cancelText: PropTypes.string.isRequired,
  };

  static defaultProps = {
    priority: 'primary',
    cancelText: 'Cancel',
    confirmText: 'Confirm',
  };

  constructor(...args) {
    super(...args);

    this.state = {
      isModalOpen: false,
      disableConfirmButton: false,
    };
    this.confirming = false;
  }

  handleConfirm = () => {
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

  handleToggle = () => {
    let {onConfirming, onCancel, disabled} = this.props;
    if (disabled) return;

    // Current state is closed, means it will toggle open
    if (!this.state.isModalOpen) {
      if (typeof onConfirming === 'function') {
        onConfirming();
      }
    } else {
      if (typeof onCancel === 'function') {
        onCancel();
      }
    }

    // Toggle modal display state
    // Also always reset `confirming` when modal visibility changes
    this.setState(state => ({
      isModalOpen: !state.isModalOpen,
      disableConfirmButton: false,
    }));

    this.confirming = false;
  };

  render() {
    let {disabled, message, priority, confirmText, cancelText, children} = this.props;

    const ConfirmModal = (
      <Modal show={this.state.isModalOpen} animation={false} onHide={this.handleToggle}>
        <div className="modal-body">
          <div>
            <strong>{message}</strong>
          </div>
        </div>
        <div className="modal-footer">
          <Button style={{marginRight: 10}} onClick={this.handleToggle}>
            {cancelText}
          </Button>
          <Button
            disabled={this.state.disableConfirmButton}
            priority={priority}
            onClick={this.handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </Modal>
    );

    return React.cloneElement(children, {
      disabled,
      children: [
        (children.props && children.props.children) || null,
        React.cloneElement(ConfirmModal, {key: 'confirm'}),
      ],
      onClick: this.handleToggle,
    });
  }
}

export default Confirm;
