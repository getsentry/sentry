import * as React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import Button from 'app/components/button';
import {t} from 'app/locale';

type MessageRenderProps = {
  /**
   * Confirms the modal
   */
  confirm: () => void;
  /**
   * Closes the modal, if `bypass` is true, will call `onConfirm` callback
   */
  close: (e: React.MouseEvent) => void;
};

type ChildrenRenderProps = {
  open: () => void;
  close: () => void;
};

const defaultProps = {
  /**
   * Button priority
   */
  priority: 'primary' as React.ComponentProps<typeof Button>['priority'],
  /**
   * Disables the confirm button
   */
  disableConfirmButton: false,
  /**
   * Text to show in the cancel button
   */
  cancelText: t('Cancel') as React.ReactNode,
  /**
   * Text to show in the confirmation button
   */
  confirmText: t('Confirm') as React.ReactNode,
  // Stop event propagation when opening the confirm modal
  stopPropagation: false,
};

type Props = {
  /**
   * Callback when user confirms
   */
  onConfirm: () => void;

  /**
   * If true, will skip the confirmation modal and call `onConfirm` callback
   */
  bypass?: boolean;

  /**
   * Message to display to user when asking for confirmation
   */
  message?: React.ReactNode;
  /**
   * Renderer that passes:
   * `confirm`: Allows renderer to perform confirm action
   * `close`: Allows renderer to toggle confirm modal
   */
  renderMessage?: (renderProps: MessageRenderProps) => React.ReactNode;

  /**
   * Render props to control rendering of the modal in its entirety
   */
  children?:
    | ((renderProps: ChildrenRenderProps) => React.ReactNode)
    | React.ReactElement<{disabled: boolean; onClick: (e: React.MouseEvent) => void}>;

  /**
   * Passed to `children` render function
   */
  disabled?: boolean;

  /**
   * Callback function when user is in the confirming state
   * called when the confirm modal is opened
   */
  onConfirming?: () => void;

  /**
   * User cancels the modal
   */
  onCancel?: () => void;

  /**
   * Header of modal
   */
  header?: React.ReactNode;
} & typeof defaultProps;

type State = {
  /**
   * Is modal open
   */
  isModalOpen: boolean;

  /**
   * Is confirm button disabled
   */
  disableConfirmButton: boolean;
};

class Confirm extends React.PureComponent<Props, State> {
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

    // Stop event propagation when opening the confirm modal
    stopPropagation: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  state: State = {
    isModalOpen: false,
    disableConfirmButton: this.props.disableConfirmButton,
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    // Reset the state to handle prop changes from ConfirmDelete
    if (props.disableConfirmButton !== state.disableConfirmButton) {
      return {
        disableConfirmButton: props.disableConfirmButton,
      };
    }
    return null;
  }

  confirming: boolean = false;

  openModal = () => {
    const {onConfirming, disableConfirmButton} = this.props;
    if (typeof onConfirming === 'function') {
      onConfirming();
    }

    this.setState({
      isModalOpen: true,
      disableConfirmButton: disableConfirmButton || false,
    });

    // always reset `confirming` when modal visibility changes
    this.confirming = false;
  };

  closeModal = () => {
    const {onCancel, disableConfirmButton} = this.props;
    if (typeof onCancel === 'function') {
      onCancel();
    }
    this.setState({
      isModalOpen: false,
      disableConfirmButton: disableConfirmButton || false,
    });

    // always reset `confirming` when modal visibility changes
    this.confirming = false;
  };

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

  handleToggle = (e: React.MouseEvent): void => {
    const {disabled, bypass, stopPropagation, onConfirm} = this.props;
    if (disabled) {
      return;
    }

    if (e && stopPropagation) {
      e.stopPropagation();
    }

    if (bypass) {
      onConfirm();
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

    let confirmMessage: React.ReactNode;

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
          : React.isValidElement(children) &&
            React.cloneElement(children, {
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
              data-test-id="confirm-button"
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
