import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {AnimationProps} from 'framer-motion';
import {AnimatePresence} from 'framer-motion';
import type {Location} from 'history';

import ErrorBoundary from 'sentry/components/errorBoundary';
import DrawerComponents from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

export interface DrawerOptions {
  /**
   * Accessbility label for the drawer
   */
  ariaLabel: string;
  /**
   * If true (default), closes the drawer when an escape key is pressed
   */
  closeOnEscapeKeypress?: boolean;
  /**
   * If true (default), closes the drawer when anywhere else is clicked
   */
  closeOnOutsideClick?: boolean;
  /**
   * Custom content for the header of the drawer
   */
  headerContent?: React.ReactNode;
  /**
   * Callback for when the drawer closes
   */
  onClose?: () => void;
  /**
   * Callback for when the drawer opens
   */
  onOpen?: () => void;
  /**
   * Function to determine whether the drawer should close when interacting with
   * other elements.
   */
  shouldCloseOnInteractOutside?: (interactedElement: Element) => boolean;
  /**
   * If true (default), closes the drawer when the location changes
   */
  shouldCloseOnLocationChange?: (newPathname: Location) => boolean;
  //
  // Custom framer motion transition for the drawer
  //
  transitionProps?: AnimationProps['transition'];
}

interface DrawerRenderProps {
  /**
   * Close the drawer
   */
  closeDrawer: () => void;
}

type DrawerRenderer = (renderProps: DrawerRenderProps) => React.ReactNode;

export interface DrawerConfig {
  options: DrawerOptions;
  renderer: DrawerRenderer | null;
}

interface DrawerContextType {
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options: DrawerConfig['options']
  ) => void;
}

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  isDrawerOpen: false,
  closeDrawer: () => {},
});

export function GlobalDrawer({children}) {
  const location = useLocation();
  const [currentDrawerConfig, overwriteDrawerConfig] = useState<
    DrawerConfig | undefined
  >();
  // If no config is set, the global drawer is closed.
  const isDrawerOpen = !!currentDrawerConfig;
  const openDrawer = useCallback<DrawerContextType['openDrawer']>(
    (renderer, options) => overwriteDrawerConfig({renderer, options}),
    []
  );
  const closeDrawer = useCallback<DrawerContextType['closeDrawer']>(
    () => overwriteDrawerConfig(undefined),
    []
  );

  const handleClose = useCallback(() => {
    currentDrawerConfig?.options?.onClose?.();
    closeDrawer();
  }, [currentDrawerConfig, closeDrawer]);

  // Close the drawer when the browser history changes.
  useLayoutEffect(
    () => {
      // Defaults to closing the drawer when the location changes
      if (currentDrawerConfig?.options.shouldCloseOnLocationChange?.(location) ?? true) {
        // Call `closeDrawer` without invoking `onClose` callback, since those callbacks often update the URL
        closeDrawer();
      }
    },
    // Ignoring changes to currentDrawerConfig?.options to prevent closing the drawer when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      location?.pathname,
      location?.search,
      location?.hash,
      closeDrawer,
      currentDrawerConfig?.options.shouldCloseOnLocationChange,
    ]
  );

  // Close the drawer when clicking outside the panel and options allow it.
  const panelRef = useRef<HTMLDivElement>(null);
  const handleClickOutside = useCallback(() => {
    if (currentDrawerConfig?.options?.closeOnOutsideClick ?? true) {
      handleClose();
    }
  }, [currentDrawerConfig, handleClose]);
  const {shouldCloseOnInteractOutside} = currentDrawerConfig?.options ?? {};
  useOnClickOutside(panelRef, e => {
    if (
      defined(shouldCloseOnInteractOutside) &&
      defined(e?.target) &&
      !shouldCloseOnInteractOutside(e.target as Element)
    ) {
      return;
    }
    handleClickOutside();
  });

  // Close the drawer when escape is pressed and options allow it.
  const handleEscapePress = useCallback(() => {
    if (currentDrawerConfig?.options?.closeOnEscapeKeypress ?? true) {
      handleClose();
    }
  }, [currentDrawerConfig, handleClose]);
  useHotkeys([{match: 'Escape', callback: handleEscapePress}], [handleEscapePress]);

  const renderedChild = currentDrawerConfig?.renderer
    ? currentDrawerConfig.renderer({
        closeDrawer: handleClose,
      })
    : null;

  return (
    <DrawerContext.Provider value={{closeDrawer, isDrawerOpen, openDrawer}}>
      <ErrorBoundary mini message={t('There was a problem rendering the drawer.')}>
        <AnimatePresence>
          {isDrawerOpen && (
            <DrawerComponents.DrawerPanel
              ariaLabel={currentDrawerConfig.options.ariaLabel}
              onClose={handleClose}
              ref={panelRef}
              headerContent={currentDrawerConfig?.options?.headerContent ?? null}
              transitionProps={currentDrawerConfig?.options?.transitionProps}
            >
              {renderedChild}
            </DrawerComponents.DrawerPanel>
          )}
        </AnimatePresence>
      </ErrorBoundary>
      {children}
    </DrawerContext.Provider>
  );
}

/**
 * Returns helper functions to control the slide out drawer above the page content. For example:
 * ```
 * const {openDrawer, closeDrawer} = useDrawer()
 * ```
 *
 * The `openDrawer` function accepts a renderer, and options. By default, the drawer will close
 * on outside clicks, and 'Escape' key presses. For example:
 * ```
 * openDrawer(() => <DrawerBody><MyComponent /></DrawerBody>, {closeOnOutsideClick: false})
 * ```
 *
 * The `closeDrawer` function accepts no parameters and closes the drawer, unmounting its contents.
 * For example:
 * ```
 * openDrawer(() => <button onClick={closeDrawer}>Close!</button>)
 * ```
 */
export default function useDrawer() {
  return useContext(DrawerContext);
}
