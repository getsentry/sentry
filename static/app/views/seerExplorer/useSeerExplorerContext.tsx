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
import {localStorageWrapper} from 'sentry/utils/localStorage';
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

export const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isOpen: false,
  openSeerExplorer: () => {},
  sessionState: 'inactive',
  toggleSeerExplorer: () => {},
  unreadCount: 0,
});

const LAST_VIEWED_STORAGE_KEY = 'seer:explorer-last-viewed';
const MAX_TRACKED_RUNS = 50;

function readLastViewedMap(): Record<string, number> {
  const raw = localStorageWrapper.getItem(LAST_VIEWED_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, number>)
    : {};
}

function persistLastViewedAt(runId: number, ts: number): void {
  const map = readLastViewedMap();
  map[String(runId)] = ts;
  const entries = Object.entries(map);
  const pruned =
    entries.length <= MAX_TRACKED_RUNS
      ? map
      : Object.fromEntries(
          entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_TRACKED_RUNS)
        );
  localStorageWrapper.setItem(LAST_VIEWED_STORAGE_KEY, JSON.stringify(pruned));
}

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

  const [lastViewedAt, setLastViewedAt] = useState<number>(() =>
    runId === null ? 0 : (readLastViewedMap()[String(runId)] ?? 0)
  );
  useEffect(() => {
    setLastViewedAt(runId === null ? 0 : (readLastViewedMap()[String(runId)] ?? 0));
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
    persistLastViewedAt(runId, latestBlockTimestamp);
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
