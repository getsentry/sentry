import {createContext, useContext, useMemo, type ReactNode} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {
  type OpenSeerExplorerDrawerOptions,
  useSeerExplorerDrawer,
} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

type SeerExplorerContextValue = {
  closeSeerExplorer: () => void;
  isMinimized: boolean; // for backward compatibility with ExplorerPanel.
  isOpen: boolean;
  openSeerExplorer: (options?: OpenSeerExplorerDrawerOptions) => void;
  setIsMinimized: (value: boolean) => void; // for backward compatibility with ExplorerPanel.
  toggleSeerExplorer: () => void;
};

export const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isMinimized: false,
  isOpen: false,
  openSeerExplorer: () => {},
  setIsMinimized: () => {},
  toggleSeerExplorer: () => {},
});

export function SeerExplorerContextProvider({children}: {children: ReactNode}) {
  const {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen,
  } = useSeerExplorerDrawer();

  const contextValue = useMemo(
    () => ({
      isOpen,
      isMinimized: false,
      setIsMinimized: () => {},
      openSeerExplorer: openSeerExplorerDrawer,
      closeSeerExplorer: closeSeerExplorerDrawer,
      toggleSeerExplorer: toggleSeerExplorerDrawer,
    }),
    [isOpen, openSeerExplorerDrawer, closeSeerExplorerDrawer, toggleSeerExplorerDrawer]
  );

  const {visible: isModalOpen} = useGlobalModal();

  useHotkeys(
    isModalOpen
      ? []
      : [
          {
            match: ['command+/', 'ctrl+/', 'command+.', 'ctrl+.'],
            callback: () => {
              toggleSeerExplorerDrawer();
            },
            includeInputs: true,
          },
        ]
  );

  return (
    <SeerExplorerContext.Provider value={contextValue}>
      {children}
    </SeerExplorerContext.Provider>
  );
}

export function useSeerExplorerContext(): SeerExplorerContextValue {
  return useContext(SeerExplorerContext);
}
