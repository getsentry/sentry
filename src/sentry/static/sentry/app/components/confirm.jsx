import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import Button from './buttons/button';
import {t} from '../locale';

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

    let confirmMessage = React.isValidElement(message) ? (
      message
    ) : (
      <p>
        <strong>{message}</strong>
      </p>
    );

    return (
      <React.Fragment>
        {React.cloneElement(children, {disabled, onClick: this.handleToggle})}
        <Modal show={this.state.isModalOpen} animation={false} onHide={this.handleToggle}>
          <div className="modal-body">{confirmMessage}</div>
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
      </React.Fragment>
    );
  }
}

export default Confirm;
