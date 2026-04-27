import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {
  type OpenSeerExplorerDrawerOptions,
  useSeerExplorerDrawer,
} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import {useSeerExplorerRunId} from 'sentry/views/seerExplorer/hooks/useSeerExplorerRunId';
import {useSeerExplorerDeepLink} from 'sentry/views/seerExplorer/utils';

type SeerExplorerSessionState = 'inactive' | 'thinking' | 'done-thinking';

type SeerExplorerContextValue = {
  closeSeerExplorer: () => void;
  isOpen: boolean;
  openSeerExplorer: (options?: OpenSeerExplorerDrawerOptions) => void;
  sessionState: SeerExplorerSessionState;
  toggleSeerExplorer: () => void;
};

export const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isOpen: false,
  openSeerExplorer: () => {},
  sessionState: 'inactive',
  toggleSeerExplorer: () => {},
});

export function SeerExplorerContextProvider({children}: {children: ReactNode}) {
  const [runId] = useSeerExplorerRunId();
  const {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen,
  } = useSeerExplorerDrawer();

  // Observes the shared session query so the button can reflect activity even
  // when the drawer is closed. Shares the underlying query with
  // `useSeerExplorer` via key-dedup, so there's no double polling.
  const {isPolling} = useSeerExplorerPolling({runId});

  // Gates `thinking` / `done-thinking`: otherwise an initial fetch of a stale
  // runId from sessionStorage flashes polling state before the user engages.
  const [hasEverOpened, setHasEverOpened] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setHasEverOpened(true);
    }
  }, [isOpen]);

  // Sticky flag: session transitioned from polling → not-polling while the
  // drawer was closed. Cleared when the drawer opens (user has seen the
  // result) or when there's no active session.
  const [isDoneThinking, setIsDoneThinking] = useState(false);
  const wasPollingRef = useRef(false);

  useEffect(() => {
    const wasPolling = wasPollingRef.current;
    wasPollingRef.current = isPolling;
    if (hasEverOpened && wasPolling && !isPolling && !isOpen && runId !== null) {
      setIsDoneThinking(true);
    }
  }, [isPolling, isOpen, runId, hasEverOpened]);

  useEffect(() => {
    if (isOpen || runId === null) {
      setIsDoneThinking(false);
    }
  }, [isOpen, runId]);

  const sessionState = hasEverOpened
    ? isDoneThinking
      ? 'done-thinking'
      : isPolling
        ? 'thinking'
        : 'inactive'
    : 'inactive';

  const contextValue = useMemo<SeerExplorerContextValue>(
    () => ({
      isOpen,
      openSeerExplorer: openSeerExplorerDrawer,
      closeSeerExplorer: closeSeerExplorerDrawer,
      toggleSeerExplorer: toggleSeerExplorerDrawer,
      sessionState,
    }),
    [
      isOpen,
      openSeerExplorerDrawer,
      closeSeerExplorerDrawer,
      toggleSeerExplorerDrawer,
      sessionState,
    ]
  );

  const {visible: isModalOpen} = useGlobalModal();

  // Deep link effect while drawer closed (drawer content handles when open)
  const deepLinkCallback = useCallback(
    (_runId: number) => openSeerExplorerDrawer({runId: _runId}),
    [openSeerExplorerDrawer]
  );

  useSeerExplorerDeepLink({
    callback: deepLinkCallback,
    enabled: !isOpen,
  });

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
