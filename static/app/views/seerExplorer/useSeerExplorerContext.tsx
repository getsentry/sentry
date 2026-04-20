import {createContext, useCallback, useContext, useState, type ReactNode} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

type SeerExplorerContextValue = {
  closeSeerExplorer: () => void;
  isMinimized: boolean;
  isOpen: boolean;
  openSeerExplorer: () => void;
  setIsMinimized: (value: boolean) => void;
  toggleSeerExplorer: () => void;
};

const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isMinimized: false,
  isOpen: false,
  openSeerExplorer: () => {},
  setIsMinimized: () => {},
  toggleSeerExplorer: () => {},
});

export function SeerExplorerContextProvider({children}: {children: ReactNode}) {
  const hasPageFrame = useHasPageFrameFeature();
  const useDrawer = hasPageFrame;

  /* PANEL VERSION */
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const {visible: isModalOpen} = useGlobalModal();

  // Stable callbacks
  const openSeerExplorerPanel = useCallback(() => setIsOpen(true), []);
  const closeSeerExplorerPanel = useCallback(() => setIsOpen(false), []);
  const toggleSeerExplorerPanel = useCallback(() => setIsOpen(prev => !prev), []);

  const panelContextValue = {
    isOpen,
    isMinimized,
    setIsMinimized,
    openSeerExplorer: openSeerExplorerPanel,
    closeSeerExplorer: closeSeerExplorerPanel,
    toggleSeerExplorer: toggleSeerExplorerPanel,
  };

  /* DRAWER VERSION */
  const {openSeerExplorerDrawer, closeSeerExplorerDrawer, toggleSeerExplorerDrawer} =
    useSeerExplorerDrawer();

  const drawerContextValue = {
    isOpen: false, // do not use
    isMinimized: false, // do not use
    setIsMinimized: () => {}, // do not use
    openSeerExplorer: openSeerExplorerDrawer,
    closeSeerExplorer: closeSeerExplorerDrawer,
    toggleSeerExplorer: toggleSeerExplorerDrawer,
  };

  useHotkeys(
    useDrawer
      ? [
          {
            match: ['command+/', 'ctrl+/', 'command+.', 'ctrl+.'],
            callback: () => {
              toggleSeerExplorerDrawer();
            },
            includeInputs: true,
          },
        ]
      : isModalOpen
        ? []
        : [
            {
              match: ['command+/', 'ctrl+/', 'command+.', 'ctrl+.'],
              callback: () => {
                if (isOpen) {
                  setIsMinimized(prev => !prev);
                } else {
                  setIsOpen(true);
                }
              },
              includeInputs: true,
            },
          ]
  );

  return (
    <SeerExplorerContext.Provider
      value={useDrawer ? drawerContextValue : panelContextValue}
    >
      {children}
    </SeerExplorerContext.Provider>
  );
}

export function useSeerExplorerContext(): SeerExplorerContextValue {
  return useContext(SeerExplorerContext);
}
