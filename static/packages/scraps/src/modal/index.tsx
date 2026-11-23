import type * as React from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {css, useTheme} from '@emotion/react';
import {ariaHideOutside} from '@react-aria/overlays';
import type {FocusTrap} from 'focus-trap';
import {createFocusTrap} from 'focus-trap';
import {AnimatePresence, motion} from 'framer-motion';
import {useStore} from 'zustand';
import {useShallow} from 'zustand/react/shallow';

import {Backdrop} from '@sentry/scraps/backdrop';
import {Container, ContainerQueryProvider, Flex, Surface} from '@sentry/scraps/layout';
import {useOverlayContext} from '@sentry/scraps/overlayContext';
import {Heading} from '@sentry/scraps/text';
import {TooltipContext} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {useScrollLock} from '@sentry/scraps/useScrollLock';

import {makeClosableHeader, makeCloseButton, ModalBody, ModalFooter} from './components';
import {DefaultModalBoundary} from './errorBoundary';
import {getModalPortal} from './portal';
import {
  closeModal as closeModalAction,
  modalStore,
  openModal,
  selectIsModalOpen,
  setFocusTrap,
} from './state';
import type {ModalOptions, ModalRenderer, ModalRenderProps} from './types';

const MotionContainer = motion.create(Container);

function useModalStore() {
  const store = useStore(
    modalStore,
    useShallow(state => ({
      modalId: state.modalId,
      renderer: state.renderer,
      options: state.options,
    }))
  );
  return {...store, visible: selectIsModalOpen(store)};
}

// Call the renderer below the boundary so errors in the callback are caught too.
function ModalContent({
  renderer,
  renderProps,
}: {
  renderProps: ModalRenderProps;
  renderer: ModalRenderer | null;
}) {
  return renderer?.(renderProps);
}

export function GlobalModal() {
  const [portal] = useState(getModalPortal);
  useLayoutEffect(() => {
    if (!portal.isConnected) {
      document.body.appendChild(portal);
    }
  }, [portal]);
  return <ModalHost portal={portal} />;
}

function ModalHost({portal}: {portal: HTMLDivElement}) {
  const {modalId, renderer, options, visible} = useModalStore();
  const {location, modal} = useOverlayContext();
  const getAppElement = modal?.getAppElement;
  const Boundary = modal?.boundaryComponent ?? DefaultModalBoundary;
  const theme = useTheme();
  const {t} = useTranslation();
  const closeEvents = options.closeEvents ?? 'all';

  const closeModal = useCallback(
    (reason?: 'close-button' | 'backdrop-click' | 'escape-key') => {
      options.onClose?.(reason);

      closeModalAction();
    },
    [options]
  );

  const handleEscapeClose = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.key !== 'Escape' ||
        e.defaultPrevented ||
        closeEvents === 'none' ||
        closeEvents === 'backdrop-click'
      ) {
        return;
      }

      closeModal('escape-key');
    },
    [closeModal, closeEvents]
  );

  const scrollLock = useScrollLock(document.body);
  // Portals retain the app's React context but leave its DOM query containers.
  // Use the portal's breakpoint here so responsive props agree with its CSS
  // container queries instead of inheriting the app's breakpoint.
  const portalRef = useRef(portal);
  const focusTrap = useRef<FocusTrap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusTrap.current = createFocusTrap(portal, {
      preventScroll: true,
      escapeDeactivates: false,
      fallbackFocus: portal,
      allowOutsideClick: true,
    });
    const trap = focusTrap.current;
    setFocusTrap(trap);
    return () => {
      trap.deactivate({returnFocus: false});
      if (modalStore.getState().focusTrap === trap) {
        setFocusTrap(undefined);
      }
    };
  }, [portal]);

  // Re-activate the trap for each modal so a replacement modal gets initial focus.
  useEffect(() => {
    const trap = focusTrap.current;
    if (!visible || !trap) {
      return;
    }
    trap.activate();
    return () => {
      trap.deactivate({returnFocus: false});
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- modalId re-runs it per modal.
  }, [visible, modalId]);

  // Runs only when the modal opens or closes. A modal that replaces another one
  // keeps the scroll lock and returns focus to what opened the first modal.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const {triggerElement} = modalStore.getState();
    const root = getAppElement?.();
    const previousAriaHidden = root?.getAttribute('aria-hidden');
    let restoreBackground = () => {};

    scrollLock.acquire();
    if (root) {
      root.setAttribute('aria-hidden', 'true');
      restoreBackground = () => {
        if (previousAriaHidden === null || previousAriaHidden === undefined) {
          root.removeAttribute('aria-hidden');
        } else {
          root.setAttribute('aria-hidden', previousAriaHidden);
        }
      };
    } else if (!getAppElement) {
      restoreBackground = ariaHideOutside([portal]);
    }

    return () => {
      scrollLock.release();
      restoreBackground();
      // Scroll is already restored, so focusing must not scroll the page again.
      triggerElement?.focus({preventScroll: true});
    };
  }, [portal, visible, scrollLock, getAppElement]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    document.addEventListener('keydown', handleEscapeClose);
    return () => document.removeEventListener('keydown', handleEscapeClose);
  }, [visible, handleEscapeClose]);

  // The overlay is fixed, so it is sized to the layout viewport. The on-screen
  // keyboard and pinch zoom only shrink the visual viewport, which would leave
  // the dialog's footer under the keyboard or off screen. Track the visible area.
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const container = containerRef.current;
    if (!visible || !viewport || !container) {
      return;
    }
    const fitToVisualViewport = () => {
      container.style.setProperty('top', `${viewport.offsetTop}px`);
      container.style.setProperty('height', `${viewport.height}px`);
      container.style.setProperty('bottom', 'auto');
    };
    fitToVisualViewport();
    viewport.addEventListener('resize', fitToVisualViewport);
    viewport.addEventListener('scroll', fitToVisualViewport);
    return () => {
      viewport.removeEventListener('resize', fitToVisualViewport);
      viewport.removeEventListener('scroll', fitToVisualViewport);
      for (const property of ['top', 'height', 'bottom']) {
        container.style.removeProperty(property);
      }
    };
  }, [visible]);

  const pathname = location?.pathname;
  // A modal can open before this host mounts. Keep it open on mount and close
  // it only when the pathname changes later.
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      closeModalAction();
    }
    previousPathname.current = pathname;
  }, [pathname]);

  const backdrop = options.backdrop ?? true;

  const allowBackdropClickClose =
    closeEvents === 'all' || closeEvents === 'backdrop-click';

  const clickClose = (e: React.MouseEvent) =>
    containerRef.current === e.target &&
    allowBackdropClickClose &&
    closeModal('backdrop-click');

  const onCloseButtonClick = useCallback(() => closeModal('close-button'), [closeModal]);

  const renderProps: ModalRenderProps = {
    CloseButton: makeCloseButton(onCloseButtonClick),
    Header: makeClosableHeader(onCloseButtonClick),
    Body: ModalBody,
    Footer: ModalFooter,
    modalContainerRef: containerRef,
    closeModal,
  };
  const {Header} = renderProps;

  return createPortal(
    <ContainerQueryProvider elementRef={portalRef}>
      <AnimatePresence>
        {backdrop && visible && (
          <Backdrop
            key="backdrop"
            zIndex="modal"
            {...(typeof backdrop === 'object' ? backdrop : {})}
          />
        )}
      </AnimatePresence>
      <Flex
        data-test-id="modal-backdrop"
        ref={containerRef}
        position="fixed"
        top="0"
        bottom="0"
        left="0"
        right="var(--scrollbar-size, 0)"
        justify="center"
        align="start"
        overflowY="auto"
        css={css`
          z-index: ${theme.zIndex.modal};
          overscroll-behavior: contain;
        `}
        style={{pointerEvents: visible ? 'auto' : 'none'}}
        onClick={backdrop ? clickClose : undefined}
      >
        <TooltipContext
          value={{
            // To ensure tooltips within the modal remain interactive (e.g., clickable or selectable),
            // they need to be rendered inside the modal's DOM node.
            container: portal,
          }}
        >
          <AnimatePresence>
            {visible && (
              <MotionContainer
                role="dialog"
                aria-modal
                width="640px"
                maxWidth="100%"
                pointerEvents="auto"
                padding={{zero: 'xl lg', '3xl': '3xl xl'}}
                css={[
                  css`
                    margin-top: 64px;
                    @container (min-width: ${theme.container['3xl']}) {
                      margin-top: 50px;
                    }
                  `,
                  options.modalCss,
                ]}
                initial={{opacity: 0, scale: 0.98}}
                animate={{opacity: 1, scale: 1}}
                exit={{
                  opacity: 0,
                  scale: 0.99,
                  transition: theme.motion.framer.exit.fast,
                }}
                transition={theme.motion.framer.enter.moderate}
              >
                <Surface variant="overlay" elevation="high">
                  {p => (
                    <Container
                      role="document"
                      position="relative"
                      padding={{zero: '3xl 2xl', '3xl': '3xl'}}
                      {...p}
                    >
                      <Boundary
                        resetKey={modalId}
                        onDismiss={onCloseButtonClick}
                        header={
                          <Header>
                            <Heading as="h2">{t('Something went wrong')}</Heading>
                          </Header>
                        }
                      >
                        <ModalContent renderer={renderer} renderProps={renderProps} />
                      </Boundary>
                    </Container>
                  )}
                </Surface>
              </MotionContainer>
            )}
          </AnimatePresence>
        </TooltipContext>
      </Flex>
    </ContainerQueryProvider>,
    portal
  );
}

/**
 * Hook to open and close the global modal.
 *
 * ```tsx
 * const {openModal, closeModal, isOpen} = useModal();
 *
 * openModal(({Header, Body, Footer, closeModal}) => (
 *   <Fragment>
 *     <Header closeButton>Title</Header>
 *     <Body>Content</Body>
 *     <Footer>
 *       <Button onClick={closeModal}>Done</Button>
 *     </Footer>
 *   </Fragment>
 * ));
 * ```
 */
interface UseModalReturn {
  closeModal: () => void;
  isOpen: boolean;
  openModal: (renderer: ModalRenderer, options?: ModalOptions) => void;
  /** @deprecated Use `isOpen` instead. */
  visible: boolean;
  focusTrap?: FocusTrap;
}

export function useModal(): UseModalReturn {
  const isOpen = useStore(modalStore, selectIsModalOpen);
  const focusTrap = useStore(modalStore, state => state.focusTrap);
  return {openModal, closeModal: closeModalAction, isOpen, visible: isOpen, focusTrap};
}

export {openModal, closeModal, isModalOpen, subscribeToModalOpen} from './state';
export type {
  ModalOptions,
  ModalRenderProps,
  ModalRenderer,
  ModalBoundaryProps,
} from './types';

/** @internal only used in tests & stories */
export {makeClosableHeader, makeCloseButton, ModalBody, ModalFooter} from './components';
