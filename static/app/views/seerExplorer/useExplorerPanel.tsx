import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useHotkeys} from 'sentry/utils/useHotkeys';

type ExplorerPanelContextValue = {
  closeExplorerPanel: () => void;
  isOpen: boolean;
  openExplorerPanel: () => void;
  toggleExplorerPanel: () => void;
};

const ExplorerPanelContext = createContext<ExplorerPanelContextValue>({
  closeExplorerPanel: () => {},
  isOpen: false,
  openExplorerPanel: () => {},
  toggleExplorerPanel: () => {},
});

export function ExplorerPanelProvider({children}: {children: ReactNode}) {
  // Initialize the global explorer panel state. Includes hotkeys.
  const [isOpen, setIsOpen] = useState(false);

  const openExplorerPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeExplorerPanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleExplorerPanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const contextValue = useMemo(
    () => ({
      isOpen,
      openExplorerPanel,
      closeExplorerPanel,
      toggleExplorerPanel,
    }),
    [isOpen, openExplorerPanel, closeExplorerPanel, toggleExplorerPanel]
  );

  // Hot keys for toggling the explorer panel.
  const {visible: isModalOpen} = useGlobalModal();

  useHotkeys(
    isModalOpen
      ? []
      : [
          {
            match: ['command+/', 'ctrl+/', 'command+.', 'ctrl+.'],
            callback: () => toggleExplorerPanel(),
            includeInputs: true,
          },
        ]
  );

  return (
    <ExplorerPanelContext.Provider value={contextValue}>
      {children}
    </ExplorerPanelContext.Provider>
  );
}

export function useExplorerPanel(): ExplorerPanelContextValue {
  return useContext(ExplorerPanelContext);
}
