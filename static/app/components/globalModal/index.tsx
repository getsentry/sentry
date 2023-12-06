import {Fragment, useCallback, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {createFocusTrap, FocusTrap} from 'focus-trap';
import {AnimatePresence, motion} from 'framer-motion';

import {closeModal as actionCloseModal} from 'sentry/actionCreators/modal';
import {ROOT_ELEMENT} from 'sentry/constants';
import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import getModalPortal from 'sentry/utils/getModalPortal';
import testableTransition from 'sentry/utils/testableTransition';

import {makeClosableHeader, makeCloseButton, ModalBody, ModalFooter} from './components';

type ModalOptions = {
  /**
   * Set to `false` to disable the backdrop from being rendered.
   * Set to `true` (the default) to show a translucent backdrop.
   */
  backdrop?: boolean;
  /**
   * By default, the modal is closed when the backdrop is clicked or the
   * escape key is pressed. This prop allows you to modify that behavior.
   * Only use when completely necessary, the defaults are important for
   * accessibility.
   *
   * 'all' (default) - the modal is automatically closed on backdrop click or
   *   escape key.
   * 'none' - the modal cannot be dismissed with either the mouse or the
   *   keyboard. The modal will need to be closed manually with `closeModal()`.
   *   This should only be used when a modal requires user input and cannot be
   *   dismissed, which is rare.
   * 'backdrop-click' - the modal cannot be dimissed by pressing the escape key.
   * 'escape-key' - the modal cannot be dismissed by clicking on the backdrop.
   *   This is useful for modals containing user input which will disappear on an
   *   accidental click.
   */
  closeEvents?: 'all' | 'none' | 'backdrop-click' | 'escape-key';
  /**
   * Additional CSS which will be applied to the modals `role="dialog"`
   * component. You may use the `[role="document"]` selector to target the
   * actual modal content to style the visual element of the modal.
   */
  modalCss?: ReturnType<typeof css>;
  /**
   * Callback for when the modal is closed
   */
  onClose?: () => void;
};

type ModalRenderProps = {
  /**
   * Body container for the modal
   */
  Body: typeof ModalBody;
  /**
   * Looks like a close button. Useful for when you don't want to render the
   * header which can include the close button.
   */
  CloseButton: ReturnType<typeof makeCloseButton>;
  /**
   * Footer container for the modal, typically for actions
   */
  Footer: typeof ModalFooter;
  /**
   * The modal header, optionally includes a close button which will close the
   * modal.
   */
  Header: ReturnType<typeof makeClosableHeader>;
  /**
   * Closes the modal
   */
  closeModal: () => void;
  /**
   * Reference to the modal's container.
   */
  modalContainerRef?: React.RefObject<HTMLDivElement>;
};

/**
 * Meta-type to make re-exporting these in the action creator easy without
 * polluting the global API namespace with duplicate type names.
 *
 * eg. you won't accidentally import ModalRenderProps from here.
 */
export type ModalTypes = {
  options: ModalOptions;
  renderProps: ModalRenderProps;
};

type Props = {
  /**
   * Note this is the callback for the main App container and NOT the calling
   * component. GlobalModal is never used directly, but is controlled via
   * stores. To access the onClose callback from the component, you must
   * specify it when using the action creator.
   */
  onClose?: () => void;
};

function GlobalModal({onClose}: Props) {
  const {renderer, options} = useLegacyStore(ModalStore);

  const closeEvents = options.closeEvents ?? 'all';

  const visible = typeof renderer === 'function';

  const closeModal = useCallback(() => {
    // Option close callback, from the thing which opened the modal
    options.onClose?.();

    // Action creator, actually closes the modal
    actionCloseModal();

    // GlobalModal onClose prop callback
    onClose?.();
  }, [options, onClose]);

  const handleEscapeClose = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.key !== 'Escape' ||
        closeEvents === 'none' ||
        closeEvents === 'backdrop-click'
      ) {
        return;
      }

      closeModal();
    },
    [closeModal, closeEvents]
  );

  const portal = getModalPortal();
  const focusTrap = useRef<FocusTrap>();
  // SentryApp might be missing on tests
  if (window.SentryApp) {
    window.SentryApp.modalFocusTrap = focusTrap;
  }

  useEffect(() => {
    focusTrap.current = createFocusTrap(portal, {
      preventScroll: true,
      escapeDeactivates: false,
      fallbackFocus: portal,
    });
  }, [portal]);

  useEffect(() => {
    const body = document.querySelector('body');
    const root = document.getElementById(ROOT_ELEMENT);

    const reset = () => {
      body?.style.removeProperty('overflow');
      root?.removeAttribute('aria-hidden');
      focusTrap.current?.deactivate();
      document.removeEventListener('keydown', handleEscapeClose);
    };

    if (visible) {
      if (body) {
        body.style.overflow = 'hidden';
      }
      root?.setAttribute('aria-hidden', 'true');
      focusTrap.current?.activate();

      document.addEventListener('keydown', handleEscapeClose);
    } else {
      reset();
    }

    return reset;
  }, [portal, handleEscapeClose, visible]);

  // Close the modal when the browser history changes
  useEffect(() => browserHistory.listen(() => actionCloseModal()), []);

  // Default to enabled backdrop
  const backdrop = options.backdrop ?? true;

  const allowBackdropClickClose =
    closeEvents === 'all' || closeEvents === 'backdrop-click';

  // Only close when we directly click outside of the modal.
  const containerRef = useRef<HTMLDivElement>(null);
  const clickClose = (e: React.MouseEvent) =>
    containerRef.current === e.target && allowBackdropClickClose && closeModal();

  const renderedChild = renderer?.({
    CloseButton: makeCloseButton(closeModal),
    Header: makeClosableHeader(closeModal),
    Body: ModalBody,
    Footer: ModalFooter,
    modalContainerRef: containerRef,
    closeModal,
  });

  return createPortal(
    <Fragment>
      <Backdrop
        style={backdrop && visible ? {opacity: 0.5, pointerEvents: 'auto'} : {}}
      />
      <Container
        data-test-id="modal-backdrop"
        ref={containerRef}
        style={{pointerEvents: visible ? 'auto' : 'none'}}
        onClick={backdrop ? clickClose : undefined}
      >
        <AnimatePresence>
          {visible && (
            <Modal role="dialog" aria-modal css={options.modalCss}>
              <Content role="document">{renderedChild}</Content>
            </Modal>
          )}
        </AnimatePresence>
      </Container>
    </Fragment>,
    portal
  );
}

const fullPageCss = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Backdrop = styled('div')`
  ${fullPageCss};
  z-index: ${p => p.theme.zIndex.modal};
  background: ${p => p.theme.black};
  will-change: opacity;
  transition: opacity 200ms;
  pointer-events: none;
  opacity: 0;
`;

const Container = styled('div')`
  ${fullPageCss};
  z-index: ${p => p.theme.zIndex.modal};
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
`;

const Modal = styled(motion.div)`
  max-width: 100%;
  width: 640px;
  pointer-events: auto;
  margin-top: 64px;
  padding: ${space(2)} ${space(1.5)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: 50px;
    padding: ${space(4)} ${space(2)};
  }
`;

Modal.defaultProps = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 15},
  transition: testableTransition({
    opacity: {duration: 0.2},
    y: {duration: 0.25},
  }),
};

const Content = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.modalBorderRadius};
  box-shadow:
    0 0 0 1px ${p => p.theme.translucentBorder},
    ${p => p.theme.dropShadowHeavy};
  position: relative;
  padding: ${space(4)} ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(4)};
  }
`;

export default GlobalModal;
