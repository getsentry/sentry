import {createContext, useCallback, useContext, useEffect, useState} from 'react';

import {
  DrawerBody,
  DrawerContainer,
  DrawerPanel,
} from 'sentry/components/globalDrawer/components';
import type {
  DrawerConfig,
  DrawerContext as TDrawerContext,
} from 'sentry/components/globalDrawer/types';
import {useLocation} from 'sentry/utils/useLocation';

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

const DrawerContext = createContext<TDrawerContext>(DEFAULT_DRAWER_CONTEXT);

export function GlobalDrawer({children}) {
  const location = useLocation();
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>(DEFAULT_DRAWER_CONFIG);
  const openDrawer = useCallback(
    (renderer, options = {}) => setDrawerConfig({renderer, options}),
    []
  );
  const closeDrawer = useCallback(() => setDrawerConfig(DEFAULT_DRAWER_CONFIG), []);
  const drawerContextValue: TDrawerContext = {
    closeDrawer,
    openDrawer,
  };
  const {renderer, options = {}} = drawerConfig;
  const {closeOnEscapeKeypress = true, closeOnOutsideClick = true} = options;

  const handleClose = useCallback(() => {
    // Callsite callback when closing the drawer
    options?.onClose?.();
    // Actually close the drawer component
    closeDrawer();
  }, [options, closeDrawer]);

  // Close the drawer when the browser history changes.
  useEffect(() => closeDrawer(), [location.pathname, closeDrawer]);
  const isDrawerOpen = typeof renderer === 'function';
  const renderedChild =
    renderer?.({
      Body: DrawerBody,
      closeDrawer: handleClose,
    }) ?? null;

  return (
    <DrawerContext.Provider value={drawerContextValue}>
      {renderer !== null && (
        <DrawerContainer data-test-id="drawer-container">
          <DrawerPanel
            isOpen={isDrawerOpen}
            onClose={handleClose}
            onOpen={options?.onOpen}
            closeOnOutsideClick={closeOnOutsideClick}
            closeOnEscapeKeypress={closeOnEscapeKeypress}
          >
            {renderedChild}
          </DrawerPanel>
        </DrawerContainer>
      )}
      {children}
    </DrawerContext.Provider>
  );
}

export default function useDrawer() {
  return useContext(DrawerContext);
}
