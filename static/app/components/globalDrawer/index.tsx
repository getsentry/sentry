import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AnimatePresence} from 'framer-motion';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {DrawerBody, DrawerPanel} from 'sentry/components/globalDrawer/components';
import type {
  DrawerConfig,
  DrawerContext as TDrawerContext,
} from 'sentry/components/globalDrawer/types';
import {t} from 'sentry/locale';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

const DrawerContext = createContext<TDrawerContext>({
  openDrawer: () => {},
  closeDrawer: () => {},
});

export function GlobalDrawer({children}) {
  const location = useLocation();
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig | undefined>();
  // If no 'drawerConfig' is set, the global drawer is closed.
  const isDrawerOpen = drawerConfig !== undefined;
  const openDrawer = useCallback<TDrawerContext['openDrawer']>(
    (renderer, options = {}) => setDrawerConfig({renderer, options}),
    []
  );
  const closeDrawer = useCallback<TDrawerContext['closeDrawer']>(
    () => setDrawerConfig(undefined),
    []
  );

  const handleClose = useCallback(() => {
    // Callsite callback when closing the drawer
    drawerConfig?.options?.onClose?.();
    // Actually close the drawer component
    closeDrawer();
  }, [drawerConfig, closeDrawer]);

  // Close the drawer when the browser history changes.
  useEffect(() => closeDrawer(), [location?.pathname, closeDrawer]);

  // Close the drawer when clicking outside the panel and options allow it.
  const panelRef = useRef<HTMLDivElement>(null);
  const handleClickOutside = useCallback(() => {
    const allowOutsideClick = drawerConfig?.options?.closeOnOutsideClick ?? true;
    if (isDrawerOpen && allowOutsideClick) {
      handleClose();
    }
  }, [drawerConfig, isDrawerOpen, handleClose]);
  useOnClickOutside(panelRef, handleClickOutside);

  // Close the drawer when escape is pressed and options allow it.
  const handleEscapePress = useCallback(() => {
    const allowEscapeKeypress = drawerConfig?.options?.closeOnOutsideClick ?? true;
    if (isDrawerOpen && allowEscapeKeypress) {
      handleClose();
    }
  }, [drawerConfig, isDrawerOpen, handleClose]);
  useHotkeys([{match: 'Escape', callback: handleEscapePress}], [handleEscapePress]);

  const renderedChild = drawerConfig
    ? drawerConfig.renderer({
        Body: DrawerBody,
        closeDrawer: handleClose,
      })
    : null;

  return (
    <DrawerContext.Provider value={{openDrawer, closeDrawer}}>
      <ErrorBoundary mini message={t('There was a problem rendering the drawer.')}>
        <AnimatePresence>
          {isDrawerOpen && (
            <DrawerPanel
              ariaLabel={drawerConfig?.options?.ariaLabel}
              onClose={handleClose}
              ref={panelRef}
            >
              {renderedChild}
            </DrawerPanel>
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
 * openDrawer((Body) => <Body><MyComponent /></Body>, {closeOnOutsideClick: false})
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
