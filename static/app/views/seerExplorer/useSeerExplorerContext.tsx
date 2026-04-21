import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';

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
  // Initialize the global explorer panel state. Includes hotkeys.
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const openSeerExplorer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSeerExplorer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleSeerExplorer = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const contextValue = useMemo(
    () => ({
      isOpen,
      isMinimized,
      openSeerExplorer,
      closeSeerExplorer,
      setIsMinimized,
      toggleSeerExplorer,
    }),
    [isOpen, isMinimized, openSeerExplorer, closeSeerExplorer, toggleSeerExplorer]
  );

  // Hot keys for toggling the explorer panel.
  const {visible: isModalOpen} = useGlobalModal();

  useHotkeys(
    isModalOpen
      ? []
      : [
          {
            match: ['command+/', 'ctrl+/', 'command+.', 'ctrl+.'],
            callback: () => {
              if (isOpen && isMinimized) {
                setIsMinimized(false);
              } else {
                toggleSeerExplorer();
              }
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
