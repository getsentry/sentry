import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';

import {DrawerBody, DrawerPanel} from 'sentry/components/globalDrawer/components';
import type {
  DrawerConfig,
  DrawerContext as TDrawerContext,
} from 'sentry/components/globalDrawer/types';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

const DEFAULT_DRAWER_CONFIG: DrawerConfig = {
  renderer: null,
  options: {
    closeOnEscapeKeypress: true,
    closeOnOutsideClick: true,
  },
};

const DEFAULT_DRAWER_CONTEXT: TDrawerContext = {
  openDrawer: () => {},
  closeDrawer: () => {},
};

const DrawerContext = createContext(DEFAULT_DRAWER_CONTEXT);

export function GlobalDrawer({children}) {
  const location = useLocation();
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>(DEFAULT_DRAWER_CONFIG);
  const openDrawer = useCallback<TDrawerContext['openDrawer']>(
    (renderer, options = {}) => setDrawerConfig({renderer, options}),
    []
  );
  const closeDrawer = useCallback<TDrawerContext['closeDrawer']>(
    () => setDrawerConfig(DEFAULT_DRAWER_CONFIG),
    []
  );
  const {renderer, options = {}} = drawerConfig;
  const {closeOnEscapeKeypress = true, closeOnOutsideClick = true} = options;
  const isDrawerOpen = renderer !== null;

  const handleClose = useCallback(() => {
    // Callsite callback when closing the drawer
    options?.onClose?.();
    // Actually close the drawer component
    closeDrawer();
  }, [options, closeDrawer]);

  // Close the drawer when the browser history changes.
  useEffect(() => closeDrawer(), [location?.pathname, closeDrawer]);

  // Close the drawer when clicking outside the panel and options allow it.
  const panelRef = useRef<HTMLDivElement>(null);
  const handleClickOutside = useCallback(() => {
    if (isDrawerOpen && closeOnOutsideClick) {
      handleClose();
    }
  }, [isDrawerOpen, closeOnOutsideClick, handleClose]);
  useOnClickOutside(panelRef, handleClickOutside);

  // Close the drawer when escape is pressed and options allow it.
  const handleEscapePress = useCallback(() => {
    if (isDrawerOpen && closeOnEscapeKeypress) {
      handleClose();
    }
  }, [isDrawerOpen, closeOnEscapeKeypress, handleClose]);
  useHotkeys([{match: 'Escape', callback: handleEscapePress}], [handleEscapePress]);

  const renderedChild =
    renderer?.({
      Body: DrawerBody,
      closeDrawer: handleClose,
    }) ?? null;

  return (
    <DrawerContext.Provider value={{openDrawer, closeDrawer}}>
      {isDrawerOpen && (
        <DrawerPanel onClose={handleClose} ref={panelRef}>
          {renderedChild}
        </DrawerPanel>
      )}
      {children}
    </DrawerContext.Provider>
  );
}

export default function useDrawer() {
  return useContext(DrawerContext);
}
