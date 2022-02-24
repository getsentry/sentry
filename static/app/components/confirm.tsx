import * as React from 'react';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Button, {ButtonProps} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';

export type ConfirmMessageRenderProps = {
  /**
   * Closes the modal, if `bypass` is true, will call `onConfirm` callback
   */
  close: (e: React.MouseEvent) => void;
  /**
   * Confirms the modal
   */
  confirm: () => void;
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

export type ConfirmButtonsRenderProps = {
  /**
   * Applications can call this function to manually close the modal.
   */
  closeModal: () => void;
  /**
   * The default onClick behavior, including closing the modal and triggering the
   * onConfirm / onCancel callbacks.
   */
  defaultOnClick: () => void;
};

type ChildrenRenderProps = {
  open: () => void;
};

export type OpenConfirmOptions = {
  /**
   * If true, will skip the confirmation modal and call `onConfirm` callback
   */
  bypass?: boolean;
  /**
   * Text to show in the cancel button
   */
  cancelText?: React.ReactNode;
  /**
   * Text to show in the confirmation button
   */
  confirmText?: React.ReactNode;
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
   * Header of modal
   */
  header?: React.ReactNode;
  /**
   * Message to display to user when asking for confirmation
   */
  message?: React.ReactNode;
  /**
   * User cancels the modal
   */
  onCancel?: () => void;
  /**
   * Callback when user confirms
   */
  onConfirm?: () => void;
  /**
   * Callback function when user is in the confirming state called when the
   * confirm modal is opened
   */
  onConfirming?: () => void;
  /**
   * Button priority
   */
  priority?: ButtonProps['priority'];
  /**
   * Custom function to render the cancel button
   */
  renderCancelButton?: (props: ConfirmButtonsRenderProps) => React.ReactNode;
  /**
   * Custom function to render the confirm button
   */
  renderConfirmButton?: (props: ConfirmButtonsRenderProps) => React.ReactNode;
  /**
   * Used to render a message instead of using the static `message` prop.
   */
  renderMessage?: (renderProps: ConfirmMessageRenderProps) => React.ReactNode;
};

type Props = OpenConfirmOptions & {
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
   * Stop event propagation when opening the confirm modal
   */
  stopPropagation?: boolean;
};

/**
 * Opens a confirmation modal when called. The procedural version of the
 * `Confirm` component
 */
export const openConfirmModal = ({
  bypass,
  onConfirming,
  priority = 'primary',
  cancelText = t('Cancel'),
  confirmText = t('Confirm'),
  disableConfirmButton = false,
  ...rest
}: OpenConfirmOptions) => {
  if (bypass) {
    rest.onConfirm?.();
    return;
  }

  const modalProps = {
    ...rest,
    priority,
    confirmText,
    cancelText,
    disableConfirmButton,
  };

  onConfirming?.();
  openModal(renderProps => <ConfirmModal {...renderProps} {...modalProps} />);
};

/**
 * The confirm component is somewhat special in that you can wrap any
 * onClick-able element with this to trigger a interstital confirmation modal.
 *
 * This is the declarative alternative to using openConfirmModal
 */
function Confirm({
  disabled,
  children,
  stopPropagation = false,
  ...openConfirmOptions
}: Props) {
  const triggerModal = (e?: React.MouseEvent) => {
    if (stopPropagation) {
      e?.stopPropagation();
    }

    if (disabled) {
      return;
    }

    openConfirmModal(openConfirmOptions);
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
    | 'renderConfirmButton'
    | 'renderCancelButton'
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
   * The callback registered from the rendered message to call
   */
  confirmCallback: null | (() => void);
  /**
   * Is confirm button disabled
   */
  disableConfirmButton: boolean;
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
    const {
      Header,
      Body,
      Footer,
      priority,
      confirmText,
      cancelText,
      header,
      renderConfirmButton,
      renderCancelButton,
    } = this.props;
    return (
      <React.Fragment>
        {header && <Header>{header}</Header>}
        <Body>{this.confirmMessage}</Body>
        <Footer>
          <ButtonBar gap={2}>
            {renderCancelButton ? (
              renderCancelButton({
                closeModal: this.props.closeModal,
                defaultOnClick: this.handleClose,
              })
            ) : (
              <Button
                onClick={this.handleClose}
                aria-label={typeof cancelText === 'string' ? cancelText : t('Cancel')}
              >
                {cancelText ?? t('Cancel')}
              </Button>
            )}
            {renderConfirmButton ? (
              renderConfirmButton({
                closeModal: this.props.closeModal,
                defaultOnClick: this.handleConfirm,
              })
            ) : (
              <Button
                data-test-id="confirm-button"
                disabled={this.state.disableConfirmButton}
                priority={priority}
                onClick={this.handleConfirm}
                autoFocus
                aria-label={typeof confirmText === 'string' ? confirmText : t('Confirm')}
              >
                {confirmText ?? t('Confirm')}
              </Button>
            )}
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default Confirm;
