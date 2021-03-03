import React from 'react';

import {ModalRenderProps, openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';

export type ConfirmMessageRenderProps = {
  /**
   * Confirms the modal
   */
  confirm: () => void;
  /**
   * Closes the modal, if `bypass` is true, will call `onConfirm` callback
   */
  close: (e: React.MouseEvent) => void;
  /**
   * Set the disabled state of the confirm button
   */
  disableConfirmButton: (disable: boolean) => void;
  /**
   * When the modal is confirmed the function registered will be called.
   *
   * Useful if your rendered message contains some functionality that should be
   * triggered upon the modal being confirmed.
   *
   * This should be called in the components componentDidMount.
   */
  setConfirmCallback: (cb: () => void) => void;
};

type ChildrenRenderProps = {
  open: () => void;
};

type Props = {
  /**
   * Callback when user confirms
   */
  onConfirm?: () => void;
  /**
   * If true, will skip the confirmation modal and call `onConfirm` callback
   */
  bypass?: boolean;
  /**
   * Message to display to user when asking for confirmation
   */
  message?: React.ReactNode;
  /**
   * Used to render a message instead of using the static `message` prop.
   */
  renderMessage?: (renderProps: ConfirmMessageRenderProps) => React.ReactNode;
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
   * Callback function when user is in the confirming state called when the
   * confirm modal is opened
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
  /**
   * Stop event propagation when opening the confirm modal
   */
  stopPropagation?: boolean;
  /**
   * Disables the confirm button.
   *
   * XXX: Once the modal has been opened mutating this property will _not_
   * propagate into the modal.
   *
   * If you need the confirm buttons disabled state to be reactively
   * controlled, consider using the renderMessage prop, which receives a
   * `disableConfirmButton` function that you may use to control the state of it.
   */
  disableConfirmButton?: boolean;
  /**
   * Button priority
   */
  priority?: React.ComponentProps<typeof Button>['priority'];
  /**
   * Text to show in the cancel button
   */
  cancelText?: React.ReactNode;
  /**
   * Text to show in the confirmation button
   */
  confirmText?: React.ReactNode;
};

function Confirm({
  bypass,
  renderMessage,
  message,
  header,
  disabled,
  children,
  onConfirm,
  onConfirming,
  onCancel,
  priority = 'primary',
  cancelText = t('Cancel'),
  confirmText = t('Confirm'),
  stopPropagation = false,
  disableConfirmButton = false,
}: Props) {
  const triggerModal = (e?: React.MouseEvent) => {
    if (stopPropagation) {
      e?.stopPropagation();
    }

    if (disabled) {
      return;
    }

    if (bypass) {
      onConfirm?.();
      return;
    }

    onConfirming?.();

    const modalProps = {
      priority,
      renderMessage,
      message,
      confirmText,
      cancelText,
      header,
      onConfirm,
      onCancel,
      disableConfirmButton,
    };

    openModal(renderProps => <ConfirmModal {...renderProps} {...modalProps} />);
  };

  if (typeof children === 'function') {
    return children({open: triggerModal});
  }

  if (!React.isValidElement(children)) {
    return null;
  }

  // TODO(ts): Understand why the return type of `cloneElement` is strange
  return React.cloneElement(children, {disabled, onClick: triggerModal}) as any;
}

type ModalProps = ModalRenderProps &
  Pick<
    Props,
    | 'priority'
    | 'renderMessage'
    | 'message'
    | 'confirmText'
    | 'cancelText'
    | 'header'
    | 'onConfirm'
    | 'onCancel'
    | 'disableConfirmButton'
  >;

type ModalState = {
  /**
   * Is confirm button disabled
   */
  disableConfirmButton: boolean;
  /**
   * The callback registered from the rendered message to call
   */
  confirmCallback: null | (() => void);
};

class ConfirmModal extends React.Component<ModalProps, ModalState> {
  state: ModalState = {
    disableConfirmButton: !!this.props.disableConfirmButton,
    confirmCallback: null,
  };

  confirming: boolean = false;

  handleClose = () => {
    const {disableConfirmButton, onCancel, closeModal} = this.props;

    onCancel?.();
    this.setState({disableConfirmButton: disableConfirmButton ?? false});

    // always reset `confirming` when modal visibility changes
    this.confirming = false;
    closeModal();
  };

  handleConfirm = () => {
    const {onConfirm, closeModal} = this.props;

    // `confirming` is used to ensure `onConfirm` or the confirm callback is
    // only called once
    if (!this.confirming) {
      onConfirm?.();
      this.state.confirmCallback?.();
    }

    this.setState({disableConfirmButton: true});
    this.confirming = true;
    closeModal();
  };

  get confirmMessage() {
    const {message, renderMessage} = this.props;

    if (typeof renderMessage === 'function') {
      return renderMessage({
        confirm: this.handleConfirm,
        close: this.handleClose,
        disableConfirmButton: (state: boolean) =>
          this.setState({disableConfirmButton: state}),
        setConfirmCallback: (confirmCallback: () => void) =>
          this.setState({confirmCallback}),
      });
    }

    if (React.isValidElement(message)) {
      return message;
    }

    return (
      <p>
        <strong>{message}</strong>
      </p>
    );
  }

  render() {
    const {Header, Body, Footer, priority, confirmText, cancelText, header} = this.props;

    return (
      <React.Fragment>
        {header && <Header>{header}</Header>}
        <Body>{this.confirmMessage}</Body>
        <Footer>
          <ButtonBar gap={2}>
            <Button onClick={this.handleClose}>{cancelText}</Button>
            <Button
              data-test-id="confirm-button"
              disabled={this.state.disableConfirmButton}
              priority={priority}
              onClick={this.handleConfirm}
              autoFocus
            >
              {confirmText}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default Confirm;
