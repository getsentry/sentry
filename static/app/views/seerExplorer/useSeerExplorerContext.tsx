import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {getDrawerWidthKey} from '@sentry/scraps/drawer';
import {useHotkeys} from '@sentry/scraps/hotkey';
import {useModal} from '@sentry/scraps/modal';
import {
  PictureInPicturePortal,
  usePictureInPicture,
} from '@sentry/scraps/pictureInPicture';

import {getDateFromTimestampAssumeUtc} from 'sentry/utils/dates';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {
  type OpenSeerExplorerDrawerOptions,
  SEER_EXPLORER_DRAWER_KEY,
  useSeerExplorerDrawer,
} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import {useSeerExplorerChatState} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {usePageReferrer, useSeerExplorerDeepLink} from 'sentry/views/seerExplorer/utils';

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

/**
 * Subscribes to a picture-in-picture window's width.
 */
function usePictureInPictureWidth(pipWindow: Window): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      pipWindow.addEventListener('resize', onStoreChange);
      return () => pipWindow.removeEventListener('resize', onStoreChange);
    },
    [pipWindow]
  );

  return useSyncExternalStore(subscribe, () => pipWindow.innerWidth);
}

/**
 * Mirrors the popped-out window's width onto the drawer's persisted width (as a
 * percent of the viewport) so the drawer adopts that width when it re-docks.
 *
 * Rendered as a leaf component so width updates re-render only this (it returns
 * nothing), not the popped-out content.
 */
function SyncDrawerWidthFromPip({pipWindow}: {pipWindow: Window}) {
  const pipWidth = usePictureInPictureWidth(pipWindow);

  useEffect(() => {
    if (pipWidth && window.innerWidth > 0) {
      localStorageWrapper.setItem(
        getDrawerWidthKey(SEER_EXPLORER_DRAWER_KEY),
        JSON.stringify((pipWidth / window.innerWidth) * 100)
      );
    }
  }, [pipWidth]);

  return null;
}

export function SeerExplorerContextProvider({children}: {children: ReactNode}) {
  const {runId, chatStates} = useSeerExplorerChatState();
  const [lastViewedAt, setLastViewedAt] = useState<number>(() => Date.now());

  const {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen,
  } = useSeerExplorerDrawer({
    onClose: () => setLastViewedAt(Date.now()),
  });

  const {getPageReferrer} = usePageReferrer();

  const {pipWindow, closePipWindow} = usePictureInPicture();
  const isPoppedOut = pipWindow !== null;

  // Re-dock into the drawer whenever the PiP window closes (native controls,
  // dock button, or programmatically) — unless a full close was requested via
  // `closeSeerExplorer`. The watcher lives here because re-docking needs the
  // drawer controls, which are only available inside `GlobalDrawer`. The drawer
  // width is kept in sync continuously by `SyncDrawerWidthFromPip`, so the
  // reopened drawer already reflects the popped-out window's width.
  const suppressRedockRef = useRef(false);
  const wasPoppedOutRef = useRef(false);
  useEffect(() => {
    const wasPoppedOut = wasPoppedOutRef.current;
    wasPoppedOutRef.current = isPoppedOut;
    if (wasPoppedOut && !isPoppedOut) {
      if (suppressRedockRef.current) {
        suppressRedockRef.current = false;
        return;
      }
      openSeerExplorerDrawer();
    }
  }, [isPoppedOut, openSeerExplorerDrawer]);

  const openSeerExplorer = useCallback(
    (drawerOptions?: OpenSeerExplorerDrawerOptions) => {
      if (pipWindow) {
        pipWindow.focus();
        return;
      }
      openSeerExplorerDrawer(drawerOptions);
    },
    [pipWindow, openSeerExplorerDrawer]
  );

  const closeSeerExplorer = useCallback(() => {
    if (pipWindow) {
      suppressRedockRef.current = true;
      closePipWindow();
      return;
    }
    closeSeerExplorerDrawer();
  }, [pipWindow, closePipWindow, closeSeerExplorerDrawer]);

  const toggleSeerExplorer = useCallback(() => {
    if (pipWindow) {
      // Re-dock back into the drawer.
      closePipWindow();
      return;
    }
    toggleSeerExplorerDrawer();
  }, [pipWindow, closePipWindow, toggleSeerExplorerDrawer]);

  const {apiData} = useSeerExplorerPolling({runId});
  const blocks = apiData?.session?.blocks;

  const pollingState = runId === null ? undefined : chatStates[runId]?.polling;
  const isPolling = pollingState === 'polling' || pollingState === 'polling-with-backoff';

  useEffect(() => {
    setLastViewedAt(Date.now());
  }, [runId]);

  const [isWindowVisible, setIsWindowVisible] = useState(
    () => document.visibilityState === 'visible'
  );
  useEffect(() => {
    const handler = () => {
      const visible = document.visibilityState === 'visible';
      setIsWindowVisible(visible);
      if (!visible) {
        setLastViewedAt(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const unreadCount = useMemo(() => {
    if (
      !blocks?.length ||
      runId === null ||
      ((isOpen || isPoppedOut) && isWindowVisible)
    ) {
      return 0;
    }
    return blocks.filter(block => {
      if (block.message.role === 'user' || block.loading) {
        return false;
      }
      const ts = getDateFromTimestampAssumeUtc(block.timestamp)?.getTime();
      return ts !== null && ts !== undefined && ts > lastViewedAt;
    }).length;
  }, [blocks, isOpen, isPoppedOut, isWindowVisible, lastViewedAt, runId]);

  // Gates `thinking` / `done-thinking`: otherwise an initial fetch of a stale
  // runId from sessionStorage flashes polling state before the user engages.
  const [hasEverOpened, setHasEverOpened] = useState(false);
  useEffect(() => {
    if (isOpen || isPoppedOut) {
      setHasEverOpened(true);
    }
  }, [isOpen, isPoppedOut]);

  // Sticky flag: session transitioned from polling → not-polling while the user
  // wasn't viewing it (drawer closed and not popped out). Cleared when the user
  // views the result (drawer open or popped out) or when there's no active
  // session.
  const [isDoneThinking, setIsDoneThinking] = useState(false);
  const wasPollingRef = useRef(false);

  useEffect(() => {
    const wasPolling = wasPollingRef.current;
    wasPollingRef.current = isPolling;
    if (
      hasEverOpened &&
      wasPolling &&
      !isPolling &&
      !isOpen &&
      !isPoppedOut &&
      runId !== null
    ) {
      setIsDoneThinking(true);
    }
  }, [isPolling, isOpen, isPoppedOut, runId, hasEverOpened]);

  useEffect(() => {
    if (isOpen || isPoppedOut || runId === null) {
      setIsDoneThinking(false);
    }
  }, [isOpen, isPoppedOut, runId]);

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
      openSeerExplorer,
      closeSeerExplorer,
      toggleSeerExplorer,
      sessionState,
      unreadCount,
    }),
    [
      isOpen,
      openSeerExplorer,
      closeSeerExplorer,
      toggleSeerExplorer,
      sessionState,
      unreadCount,
    ]
  );

  const {visible: isModalOpen} = useModal();

  // Deep link effect while Seer isn't already showing (the drawer content
  // handles deep links itself when open or popped out).
  const deepLinkCallback = useCallback(
    (_runId: number) => openSeerExplorer({runId: _runId}),
    [openSeerExplorer]
  );

  useSeerExplorerDeepLink({
    callback: deepLinkCallback,
    enabled: !isOpen && !isPoppedOut,
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
              toggleSeerExplorer();
            },
            includeInputs: true,
          },
        ]
  );

  return (
    <SeerExplorerContext.Provider value={contextValue}>
      {children}
      {pipWindow && (
        <PictureInPicturePortal pipWindow={pipWindow}>
          <SyncDrawerWidthFromPip pipWindow={pipWindow} />
          <ExplorerDrawerContent getPageReferrer={getPageReferrer} />
        </PictureInPicturePortal>
      )}
    </SeerExplorerContext.Provider>
  );
}

export function useSeerExplorerContext(): SeerExplorerContextValue {
  return useContext(SeerExplorerContext);
}
