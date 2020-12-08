import React from 'react';
import PropTypes from 'prop-types';

import {openModal} from 'app/actionCreators/modal';
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
  /**
   * Stop event propagation when opening the confirm modal
   */
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
    disableConfirmButton: this.props.disableConfirmButton,
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    // Reset the state to handle prop changes from ConfirmDelete
    return props.disableConfirmButton !== state.disableConfirmButton
      ? {disableConfirmButton: props.disableConfirmButton}
      : null;
  }

  confirming: boolean = false;

  openModal = (e?: React.MouseEvent) => {
    const {disabled, bypass, stopPropagation, onConfirm} = this.props;

    if (stopPropagation) {
      e?.stopPropagation();
    }

    if (disabled) {
      return;
    }

    if (bypass) {
      onConfirm();
      return;
    }

    const {onConfirming, disableConfirmButton} = this.props;

    onConfirming?.();
    this.setState({disableConfirmButton: disableConfirmButton || false});

    // always reset `confirming` when modal visibility changes
    this.confirming = false;

    this.activateModal();
  };

  activateModal = () =>
    openModal(({Header, Body, Footer, closeModal}) => {
      const {
        priority,
        renderMessage,
        message,
        confirmText,
        cancelText,
        header,
        onConfirm,
        onCancel,
        disableConfirmButton,
      } = this.props;

      const handleClose = () => {
        onCancel?.();
        this.setState({disableConfirmButton: disableConfirmButton || false});

        // always reset `confirming` when modal visibility changes
        this.confirming = false;
        closeModal();
      };

      const handleConfirm = () => {
        // `confirming` is used to make sure `onConfirm` is only called once
        if (!this.confirming) {
          onConfirm();
        }

        this.setState({disableConfirmButton: true});
        this.confirming = true;
        closeModal();
      };

      const confirmMessage =
        typeof renderMessage === 'function' ? (
          renderMessage({
            confirm: handleConfirm,
            close: handleClose,
          })
        ) : React.isValidElement(message) ? (
          message
        ) : (
          <p>
            <strong>{message}</strong>
          </p>
        );

      return (
        <React.Fragment>
          {header && <Header>{header}</Header>}
          <Body>{confirmMessage}</Body>
          <Footer>
            <Button style={{marginRight: 10}} onClick={handleClose}>
              {cancelText}
            </Button>
            <Button
              data-test-id="confirm-button"
              disabled={this.state.disableConfirmButton}
              priority={priority}
              onClick={handleConfirm}
              autoFocus
            >
              {confirmText}
            </Button>
          </Footer>
        </React.Fragment>
      );
    });

  render() {
    const {disabled, children} = this.props;

    return typeof children === 'function'
      ? children({open: this.openModal})
      : React.isValidElement(children) &&
          React.cloneElement(children, {disabled, onClick: this.openModal});
  }
}

export default Confirm;
