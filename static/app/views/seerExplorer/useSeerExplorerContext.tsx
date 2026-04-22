import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {
  type OpenSeerExplorerDrawerOptions,
  useSeerExplorerDrawer,
} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

type SeerExplorerContextValue = {
  closeSeerExplorer: () => void;
  isOpen: boolean;
  openSeerExplorer: (options?: OpenSeerExplorerDrawerOptions) => void;
  runId: number | null;
  setRunId: (value: SetStateAction<number | null>) => void;
  toggleSeerExplorer: () => void;
};

export const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isOpen: false,
  openSeerExplorer: () => {},
  runId: null,
  setRunId: () => {},
  toggleSeerExplorer: () => {},
});

export function SeerExplorerContextProvider({children}: {children: ReactNode}) {
  const [runId, setRunId] = useSessionStorage<number | null>(
    'seer-explorer-run-id',
    null
  );

  const {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen,
  } = useSeerExplorerDrawer({runId, setRunId});

  const contextValue = useMemo(
    () => ({
      isOpen,
      isMinimized: false,
      setIsMinimized: () => {},
      openSeerExplorer: openSeerExplorerDrawer,
      closeSeerExplorer: closeSeerExplorerDrawer,
      toggleSeerExplorer: toggleSeerExplorerDrawer,
      runId,
      setRunId,
    }),
    [
      isOpen,
      openSeerExplorerDrawer,
      closeSeerExplorerDrawer,
      toggleSeerExplorerDrawer,
      runId,
      setRunId,
    ]
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
