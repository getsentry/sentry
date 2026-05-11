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
import {useModal} from '@sentry/scraps/modal';

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
  unreadCount: number;
};

const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isOpen: false,
  openSeerExplorer: () => {},
  sessionState: 'inactive',
  toggleSeerExplorer: () => {},
  unreadCount: 0,
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
  const {isPolling, apiData} = useSeerExplorerPolling({runId});
  const blocks = apiData?.session?.blocks;

  const [lastViewedAt, setLastViewedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    setLastViewedAt(Date.now());
  }, [runId]);

  const latestBlockTimestamp = useMemo(() => {
    if (!blocks?.length) {
      return 0;
    }
    let latest = 0;
    for (const block of blocks) {
      const ts = new Date(block.timestamp).getTime();
      if (Number.isFinite(ts) && ts > latest) {
        latest = ts;
      }
    }
    return latest;
  }, [blocks]);

  const unreadCount = useMemo(() => {
    if (!blocks?.length || runId === null) {
      return 0;
    }
    return blocks.filter(block => {
      if (block.message.role === 'user' || block.loading) {
        return false;
      }
      const ts = new Date(block.timestamp).getTime();
      return Number.isFinite(ts) && ts > lastViewedAt;
    }).length;
  }, [blocks, lastViewedAt, runId]);

  useEffect(() => {
    if (!isOpen || runId === null || latestBlockTimestamp <= lastViewedAt) {
      return;
    }
    setLastViewedAt(latestBlockTimestamp);
  }, [isOpen, runId, latestBlockTimestamp, lastViewedAt]);

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
      unreadCount,
    }),
    [
      isOpen,
      openSeerExplorerDrawer,
      closeSeerExplorerDrawer,
      toggleSeerExplorerDrawer,
      sessionState,
      unreadCount,
    ]
  );

  const {visible: isModalOpen} = useModal();

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
            match: [
              'mod+/', // QWERTY (US, UK, most CJK, RTL scripts)
              'mod+.', // macOS-friendly alternative
              'mod+shift+7', // QWERTZ (German, Austrian, Swiss): / === Shift+7
              'mod+shift+.', // AZERTY (French, Belgian): / === Shift+.
              'mod+shift+-', // QWERTY Latin variants (Spanish, Italian, Portuguese): / === Shift+-
            ],
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
