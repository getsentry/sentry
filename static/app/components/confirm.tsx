import {cloneElement, Fragment, isValidElement, useRef, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
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

type ConfirmButtonsRenderProps = {
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
   * Message to display to user when an error occurs. Only used if `onConfirmAsync` is
   * provided and the promise rejects.
   */
  errorMessage?: React.ReactNode;
  /**
   * Header of modal
   */
  header?: React.ReactNode;
  /**
   * By default, the Confirm button has autofocus.
   * However, if `isDangerous` is true, the Cancel button receives autofocus instead,
   * preventing users from accidental modification of dangerous settings.
   */
  isDangerous?: boolean;
  /**
   * Message to display to user when asking for confirmation
   */
  message?: React.ReactNode;
  /**
   * User cancels the modal
   */
  onCancel?: () => void;
  /**
   * User closes the modal
   */
  onClose?: () => void;
  /**
   * Callback when user confirms
   *
   * If you pass a promise, the modal will not close until it resolves.
   * To customize the error message in case of rejection, pass the `errorMessage` prop.
   */
  onConfirm?: () => void | Promise<void>;
  /**
   * Callback function when user is in the confirming state called when the
   * confirm modal is opened
   */
  onConfirming?: () => void;
  /**
   * Modal is rendered
   */
  onRender?: () => void;
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

interface Props extends OpenConfirmOptions {
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
}

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
  onClose,
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
  openModal(renderProps => <ConfirmModal {...renderProps} {...modalProps} />, {onClose});
};

/**
 * The confirm component is somewhat special in that you can wrap any
 * onClick-able element with this to trigger a interstitial confirmation modal.
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

  if (!isValidElement(children)) {
    return null;
  }

  // TODO(ts): Understand why the return type of `cloneElement` is strange
  return cloneElement(children, {disabled, onClick: triggerModal}) as any;
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
    | 'isDangerous'
    | 'onConfirm'
    | 'onCancel'
    | 'disableConfirmButton'
    | 'onRender'
    | 'errorMessage'
  >;

function ConfirmModal({
  Header,
  Body,
  Footer,
  priority,
  confirmText,
  cancelText,
  header,
  isDangerous,
  renderConfirmButton,
  renderCancelButton,
  disableConfirmButton,
  onCancel,
  onConfirm,
  renderMessage,
  message,
  errorMessage = t('Something went wrong. Please try again.'),
  closeModal,
}: ModalProps) {
  const confirmCallbackRef = useRef<() => void>(() => {});
  const isConfirmingRef = useRef(false);
  const [shouldDisableConfirmButton, setShouldDisableConfirmButton] =
    useState(disableConfirmButton);
  const [isError, setIsError] = useState(false);

  const handleClose = () => {
    onCancel?.();
    setShouldDisableConfirmButton(disableConfirmButton ?? false);

    // always reset `confirming` when modal visibility changes
    isConfirmingRef.current = false;
    closeModal();
  };

  const handleConfirm = async () => {
    if (isConfirmingRef.current) {
      return;
    }

    isConfirmingRef.current = true;
    setShouldDisableConfirmButton(true);

    if (onConfirm) {
      try {
        await onConfirm();
      } catch (error) {
        setIsError(true);
        setShouldDisableConfirmButton(disableConfirmButton ?? false);
        return;
      } finally {
        isConfirmingRef.current = false;
      }
    }

    confirmCallbackRef.current();
    closeModal();
  };

  const makeConfirmMessage = () => {
    if (typeof renderMessage === 'function') {
      return renderMessage({
        confirm: handleConfirm,
        close: handleClose,
        disableConfirmButton: (state: boolean) => setShouldDisableConfirmButton(state),
        setConfirmCallback: (confirmCallback: () => void) =>
          (confirmCallbackRef.current = confirmCallback),
      });
    }

    if (isValidElement(message)) {
      return message;
    }

    return <p style={{wordWrap: 'break-word'}}>{message}</p>;
  };

  return (
    <Fragment>
      {header && <Header>{header}</Header>}
      <Body>
        {isError && (
          <Alert.Container>
            <Alert type="danger" showIcon={false}>
              {errorMessage}
            </Alert>
          </Alert.Container>
        )}
        {makeConfirmMessage()}
      </Body>
      <Footer>
        <ButtonBar gap="xl">
          {renderCancelButton ? (
            renderCancelButton({
              closeModal,
              defaultOnClick: handleClose,
            })
          ) : (
            <Button
              onClick={handleClose}
              autoFocus={!!isDangerous}
              aria-label={typeof cancelText === 'string' ? cancelText : t('Cancel')}
            >
              {cancelText ?? t('Cancel')}
            </Button>
          )}
          {renderConfirmButton ? (
            renderConfirmButton({
              closeModal,
              defaultOnClick: handleConfirm,
            })
          ) : (
            <Button
              data-test-id="confirm-button"
              disabled={shouldDisableConfirmButton}
              priority={priority}
              onClick={handleConfirm}
              autoFocus={!isDangerous}
              aria-label={typeof confirmText === 'string' ? confirmText : t('Confirm')}
            >
              {confirmText ?? t('Confirm')}
            </Button>
          )}
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default Confirm;
