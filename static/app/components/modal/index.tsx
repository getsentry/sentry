import {Fragment, ReactNode, useCallback, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {createFocusTrap, FocusTrap} from 'focus-trap';
import {AnimatePresence, motion} from 'framer-motion';

import {closeModal as actionCloseModal} from 'sentry/actionCreators/modal';
import {ROOT_ELEMENT} from 'sentry/constants';
import space from 'sentry/styles/space';
import getModalPortal from 'sentry/utils/getModalPortal';
import testableTransition from 'sentry/utils/testableTransition';

import {
  CloseButton,
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from './components';

type ModalOptions = {
  /**
   * Set to `false` to disable the ability to click outside the modal to
   * close it. This is useful for modals containing user input which will
   * disappear on an accidental click. Defaults to `true`.
   */
  allowClickClose?: boolean;
  /**
   * Set to `false` to disable the backdrop from being rendered. Set to
   * `static` to disable the 'click outside' behavior from closing the modal.
   * Set to true (the default) to show a translucent backdrop
   */
  backdrop?: 'static' | boolean;
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
   * Configuration of the modal
   */
  options: ModalOptions;
  /**
   * Is the modal visible
   */
  visible: boolean;
  /**
   * A function that returns a React Element
   */
  children?: ReactNode | ((renderProps: ModalRenderProps) => ReactNode);
  /**
   * Setting this to true renders a close button in top right.
   * This should always be included when a custom close button is not provided.
   */
  closeButton?: boolean;
  /**
   * Called when the modal should close, such as when the escape key is pressed,
   * or the background or close button is clicked.
   */
  onClose?: () => void;
};

function Modal({closeButton, visible = false, options = {}, children, onClose}: Props) {
  const closeModal = useCallback(() => {
    options.onClose?.();
    onClose?.();
  }, [onClose, options]);

  const handleEscapeClose = useCallback(
    (e: KeyboardEvent) => e.key === 'Escape' && closeModal(),
    [closeModal]
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

    if (!body || !root) {
      return () => void 0;
    }

    const reset = () => {
      body.style.removeProperty('overflow');
      root.removeAttribute('aria-hidden');
      focusTrap.current?.deactivate();
      document.removeEventListener('keydown', handleEscapeClose);
    };

    if (visible) {
      body.style.overflow = 'hidden';
      root.setAttribute('aria-hidden', 'true');
      focusTrap.current?.activate();

      document.addEventListener('keydown', handleEscapeClose);
    } else {
      reset();
    }

    return reset;
  }, [portal, handleEscapeClose, visible]);

  // Close the modal when the browser history changes
  useEffect(() => browserHistory.listen(() => actionCloseModal()), []);

  const renderedChild =
    typeof children === 'function'
      ? children({
          CloseButton: makeCloseButton(closeModal),
          Header: makeClosableHeader(closeModal),
          Body: ModalBody,
          Footer: ModalFooter,
          closeModal,
        })
      : children;

  // Default to enabled backdrop
  const backdrop = options.backdrop ?? true;

  // Default to enabled click close
  const allowClickClose = options.allowClickClose ?? true;

  // Only close when we directly click outside of the modal.
  const containerRef = useRef<HTMLDivElement>(null);
  const clickClose = (e: React.MouseEvent) =>
    containerRef.current === e.target && allowClickClose && closeModal();

  return createPortal(
    <Fragment>
      <Backdrop
        style={backdrop && visible ? {opacity: 0.5, pointerEvents: 'auto'} : {}}
      />
      <Container
        ref={containerRef}
        style={{pointerEvents: visible ? 'auto' : 'none'}}
        onClick={backdrop === true ? clickClose : undefined}
      >
        <AnimatePresence>
          {visible && (
            <StyledModal role="dialog" aria-modal css={options.modalCss}>
              <Content role="document">
                {closeButton && <CloseButton onClick={onClose} />}
                {renderedChild}
              </Content>
            </StyledModal>
          )}
        </AnimatePresence>
      </Container>
    </Fragment>,
    portal
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;

export default Modal;

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

const StyledModal = styled(motion.div)`
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

StyledModal.defaultProps = {
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
  border-radius: 8px;
  box-shadow: 0 0 0 1px ${p => p.theme.translucentBorder}, ${p => p.theme.dropShadowHeavy};
  position: relative;
  padding: ${space(4)} ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(4)};
  }
`;
