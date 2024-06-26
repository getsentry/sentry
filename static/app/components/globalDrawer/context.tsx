import {createContext, useCallback, useContext, useState} from 'react';

import type {DrawerOptions, DrawerRenderProps} from 'sentry/components/globalDrawer';

type DrawerRenderer = (renderProps: DrawerRenderProps) => React.ReactNode;
interface DrawerConfig {
  renderer: DrawerRenderer | null;
  options?: DrawerOptions;
}

interface DrawerContextProps {
  closeDrawer: () => void;
  config: DrawerConfig;
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options?: DrawerConfig['options']
  ) => void;
}

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

export const DrawerContext = createContext<DrawerContextProps>(DEFAULT_DRAWER_CONTEXT);

interface DrawerContextProviderProps {
  children: React.ReactNode;
}

export function DrawerContextProvider({children}: DrawerContextProviderProps) {
  const drawerContext = useDrawerProvider();
  return (
    <DrawerContext.Provider value={drawerContext}>{children}</DrawerContext.Provider>
  );
}

function useDrawerProvider(): DrawerContextProps {
  const [drawerConfig, setDrawerConfig] = useState(DEFAULT_DRAWER_CONTEXT.config);
  const openDrawer = useCallback(
    (renderer, options = {}) => setDrawerConfig({renderer, options}),
    [setDrawerConfig]
  );
  const closeDrawer = useCallback(
    () => setDrawerConfig(DEFAULT_DRAWER_CONTEXT.config),
    [setDrawerConfig]
  );

  return {config: drawerConfig, openDrawer, closeDrawer};
}

export default function useDrawer() {
  return useContext(DrawerContext);
}
