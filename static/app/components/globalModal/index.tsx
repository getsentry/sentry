import * as React from 'react';
import ReactDOM from 'react-dom';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {createFocusTrap, FocusTrap} from 'focus-trap';
import {AnimatePresence, motion} from 'framer-motion';

import {closeModal as actionCloseModal} from 'app/actionCreators/modal';
import {ROOT_ELEMENT} from 'app/constants';
import ModalStore from 'app/stores/modalStore';
import space from 'app/styles/space';
import getModalPortal from 'app/utils/getModalPortal';
import testableTransition from 'app/utils/testableTransition';

import {makeClosableHeader, makeCloseButton, ModalBody, ModalFooter} from './components';

type ModalOptions = {
  /**
   * Callback for when the modal is closed
   */
  onClose?: () => void;
  /**
   * Additional CSS which will be applied to the modals `role="dialog"`
   * component. You may use the `[role="document"]` selector to target the
   * actual modal content to style the visual element of the modal.
   */
  modalCss?: ReturnType<typeof css>;
  /**
   * Set to `false` to disable the backdrop from being rendered. Set to
   * `static` to disable the 'click outside' behavior from closing the modal.
   * Set to true (the default) to show a translucent backdrop
   */
  backdrop?: 'static' | boolean;
};

type ModalRenderProps = {
  /**
   * Closes the modal
   */
  closeModal: () => void;
  /**
   * The modal header, optionally includes a close button which will close the
   * modal.
   */
  Header: ReturnType<typeof makeClosableHeader>;
  /**
   * Body container for the modal
   */
  Body: typeof ModalBody;
  /**
   * Footer container for the modal, typically for actions
   */
  Footer: typeof ModalFooter;
  /**
   * Looks like a close button. Useful for when you don't want to render the
   * header which can include the close button.
   */
  CloseButton: ReturnType<typeof makeCloseButton>;
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
  children?: null | ((renderProps: ModalRenderProps) => React.ReactNode);
  /**
   * Note this is the callback for the main App container and NOT the calling
   * component. GlobalModal is never used directly, but is controlled via
   * stores. To access the onClose callback from the component, you must
   * specify it when using the action creator.
   */
  onClose?: () => void;
};

function GlobalModal({visible = false, options = {}, children, onClose}: Props) {
  const closeModal = React.useCallback(() => {
    // Option close callback, from the thing which opened the modal
    options.onClose?.();

    // Action creator, actually closes the modal
    actionCloseModal();

    // GlobalModal onClose prop callback
    onClose?.();
  }, [options]);

  const handleEscapeClose = React.useCallback(
    (e: KeyboardEvent) => e.key === 'Escape' && closeModal(),
    [closeModal]
  );

  const portal = getModalPortal();
  const focusTrap = React.useRef<FocusTrap>();
  // SentryApp might be missing on tests
  if (window.SentryApp) {
    window.SentryApp.modalFocusTrap = focusTrap;
  }

  React.useEffect(() => {
    focusTrap.current = createFocusTrap(portal, {
      preventScroll: true,
      escapeDeactivates: false,
      fallbackFocus: portal,
    });
  }, [portal]);

  React.useEffect(() => {
    const body = document.querySelector('body');
    const root = document.getElementById(ROOT_ELEMENT);

    if (!body || !root) {
      return () => void 0;
    }

    const reset = () => {
      body.style.removeProperty('overflow');
      root.removeAttribute('aria-hidden');
      focusTrap.current?.deactivate();
      portal.removeEventListener('keydown', handleEscapeClose);
    };

    if (visible) {
      body.style.overflow = 'hidden';
      root.setAttribute('aria-hidden', 'true');
      focusTrap.current?.activate();

      portal.addEventListener('keydown', handleEscapeClose);
    } else {
      reset();
    }

    return reset;
  }, [portal, handleEscapeClose, visible]);

  const renderedChild = children?.({
    CloseButton: makeCloseButton(closeModal),
    Header: makeClosableHeader(closeModal),
    Body: ModalBody,
    Footer: ModalFooter,
    closeModal,
  });

  // Default to enabled backdrop
  const backdrop = options.backdrop ?? true;

  // Only close when we directly click outside of the modal.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const clickClose = (e: React.MouseEvent) =>
    containerRef.current === e.target && closeModal();

  return ReactDOM.createPortal(
    <React.Fragment>
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
            <Modal role="dialog" css={options.modalCss}>
              <Content role="document">{renderedChild}</Content>
            </Modal>
          )}
        </AnimatePresence>
      </Container>
    </React.Fragment>,
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
  background: ${p => p.theme.gray500};
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
  width: 640px;
  pointer-events: auto;
  padding: 80px ${space(2)} ${space(4)} ${space(2)};
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
  padding: ${space(4)};
  background: ${p => p.theme.background};
  border-radius: 8px;
  border: ${p => p.theme.modalBorder};
  box-shadow: ${p => p.theme.modalBoxShadow};
`;

type State = {
  modalStore: ReturnType<typeof ModalStore.get>;
};

class GlobalModalContainer extends React.Component<Partial<Props>, State> {
  state: State = {
    modalStore: ModalStore.get(),
  };

  componentDidMount() {
    // Listen for route changes so we can dismiss modal
    this.unlistenBrowserHistory = browserHistory.listen(() => actionCloseModal());
  }

  componentWillUnmount() {
    this.unlistenBrowserHistory?.();
    this.unlistener?.();
  }

  unlistener = ModalStore.listen(
    (modalStore: State['modalStore']) => this.setState({modalStore}),
    undefined
  );

  unlistenBrowserHistory?: ReturnType<typeof browserHistory.listen>;

  render() {
    const {modalStore} = this.state;
    const visible = !!modalStore && typeof modalStore.renderer === 'function';

    return (
      <GlobalModal {...this.props} {...modalStore} visible={visible}>
        {visible ? modalStore.renderer : null}
      </GlobalModal>
    );
  }
}

export default GlobalModalContainer;
