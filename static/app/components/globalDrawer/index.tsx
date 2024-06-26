import {createContext, useCallback, useContext, useEffect, useState} from 'react';

import {
  DrawerBody,
  DrawerContainer,
  DrawerPanel,
} from 'sentry/components/globalDrawer/components';
import type {
  DrawerConfig,
  DrawerContext as DrawerUsageContext,
  DrawerContextProps,
} from 'sentry/components/globalDrawer/types';
import {useLocation} from 'sentry/utils/useLocation';

const DEFAULT_DRAWER_CONTEXT: DrawerContextProps = {
  config: {
    renderer: null,
    options: {
      closeOnEscapeKeypress: true,
      closeOnOutsideClick: true,
    },
  },
  openDrawer: () => {},
  closeDrawer: () => {},
};

const DrawerContext = createContext<DrawerContextProps>(DEFAULT_DRAWER_CONTEXT);

export function DrawerContextProvider({children}) {
  const location = useLocation();
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>(
    DEFAULT_DRAWER_CONTEXT.config
  );
  const openDrawer = useCallback(
    (renderer, options = {}) => setDrawerConfig({renderer, options}),
    [setDrawerConfig]
  );
  const closeDrawer = useCallback(
    () => setDrawerConfig(DEFAULT_DRAWER_CONTEXT.config),
    [setDrawerConfig]
  );
  const drawerContextValue: DrawerContextProps = {
    config: drawerConfig,
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
      {children}
    </DrawerContext.Provider>
  );
}

export default function useDrawer(): DrawerUsageContext {
  const {openDrawer, closeDrawer} = useContext(DrawerContext);
  return {openDrawer, closeDrawer};
}
