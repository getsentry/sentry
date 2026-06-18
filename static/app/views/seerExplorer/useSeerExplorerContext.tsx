import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
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
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {
  type OpenSeerExplorerDrawerOptions,
  SEER_EXPLORER_DRAWER_KEY,
  useSeerExplorerDrawer,
} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/seerExplorerContent';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import {
  useSeerExplorerChatDispatch,
  useSeerExplorerChatState,
} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import type {SeerExplorerSidebarPosition} from 'sentry/views/seerExplorer/types';
import {
  SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY,
  type SeerExplorerSidebarOrientation,
  useIsSeerExplorerSidebarEnabled,
  usePageReferrer,
  useSeerExplorerDeepLink,
  useSeerExplorerSidebarOrientation,
} from 'sentry/views/seerExplorer/utils';

type SeerExplorerSessionState = 'inactive' | 'thinking' | 'done-thinking';

type SeerExplorerContextValue = {
  closeSeerExplorer: () => void;
  isOpen: boolean;
  /**
   * Whether Seer renders as a persistent split-panel sidebar (flag on) rather
   * than an overlay drawer.
   */
  isSidebarMode: boolean;
  openSeerExplorer: (options?: OpenSeerExplorerDrawerOptions) => void;
  sessionState: SeerExplorerSessionState;
  /**
   * Persisted sidebar dock preference. Only meaningful in sidebar mode.
   */
  setSidebarPosition: (position: SeerExplorerSidebarPosition) => void;
  /**
   * Ref attached by the sidebar layout to its measuring container, so the
   * provider can read the available size when persisting the popped-out
   * window's size. Only meaningful in sidebar mode.
   */
  sidebarContainerRef: RefObject<HTMLDivElement | null>;
  /**
   * Query to auto-submit into the sidebar content, forwarded from the command
   * palette. Only meaningful in sidebar mode.
   */
  sidebarInitialQuery: string | undefined;
  /**
   * Increments on each forwarded query so the (always-mounted) sidebar content
   * resubmits a re-forwarded query. Only meaningful in sidebar mode.
   */
  sidebarKey: number;
  sidebarPosition: SeerExplorerSidebarPosition;
  toggleSeerExplorer: () => void;
  unreadCount: number;
};

const SeerExplorerContext = createContext<SeerExplorerContextValue>({
  closeSeerExplorer: () => {},
  isOpen: false,
  isSidebarMode: false,
  openSeerExplorer: () => {},
  sessionState: 'inactive',
  sidebarContainerRef: {current: null},
  setSidebarPosition: () => {},
  sidebarInitialQuery: undefined,
  sidebarKey: 0,
  sidebarPosition: 'auto',
  toggleSeerExplorer: () => {},
  unreadCount: 0,
});

/**
 * Subscribes to a picture-in-picture window's inner size.
 */
function usePictureInPictureSize(pipWindow: Window): {height: number; width: number} {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      pipWindow.addEventListener('resize', onStoreChange);
      return () => pipWindow.removeEventListener('resize', onStoreChange);
    },
    [pipWindow]
  );

  const width = useSyncExternalStore(subscribe, () => pipWindow.innerWidth);
  const height = useSyncExternalStore(subscribe, () => pipWindow.innerHeight);
  return {width, height};
}

/**
 * Persists the popped-out window's size onto the active surface so it is adopted
 * when the content re-docks:
 *
 * - Drawer: the width as a percent of the viewport, under the drawer's width key.
 * - Sidebar: the popped-out dimension *is* Seer's size (width when docked right,
 *   height when docked bottom), stored under the Seer-size key. The sidebar lays
 *   the content area out around it, so no container measurement is needed.
 *
 * Rendered as a leaf component so size updates re-render only this (it returns
 * nothing), not the popped-out content.
 */
function SyncSurfaceSizeFromPip({
  pipWindow,
  isSidebarMode,
  orientation,
}: {
  isSidebarMode: boolean;
  orientation: SeerExplorerSidebarOrientation;
  pipWindow: Window;
}) {
  const {width: pipWidth, height: pipHeight} = usePictureInPictureSize(pipWindow);

  useEffect(() => {
    if (!isSidebarMode) {
      if (pipWidth && window.innerWidth > 0) {
        localStorageWrapper.setItem(
          getDrawerWidthKey(SEER_EXPLORER_DRAWER_KEY),
          JSON.stringify((pipWidth / window.innerWidth) * 100)
        );
      }
      return;
    }

    // The popped-out dimension is Seer's size; the sidebar stores it as a plain
    // integer of px and flexes the content area around it.
    if (orientation === 'bottom') {
      if (pipHeight > 0) {
        localStorage.setItem(
          SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY.bottom,
          String(Math.round(pipHeight))
        );
      }
    } else if (pipWidth > 0) {
      localStorage.setItem(
        SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY.right,
        String(Math.round(pipWidth))
      );
    }
  }, [pipWidth, pipHeight, isSidebarMode, orientation]);

  return null;
}

export function SeerExplorerContextProvider({children}: {children: ReactNode}) {
  const {runId, chatStates} = useSeerExplorerChatState();
  const dispatch = useSeerExplorerChatDispatch();
  const [lastViewedAt, setLastViewedAt] = useState<number>(() => Date.now());

  const isSidebarMode = useIsSeerExplorerSidebarEnabled();

  const {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen: isDrawerOpen,
  } = useSeerExplorerDrawer({
    onClose: () => setLastViewedAt(Date.now()),
  });

  // Sidebar (split-panel) state. Open state is ephemeral — resets on reload,
  // like the drawer; only the dock preference persists.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isSidebarOpenRef = useRef(isSidebarOpen);
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);
  // Query forwarded from the command palette to auto-submit into the persistent
  // sidebar content (mirrors the drawer's `initialQuery` prop). The nonce bumps
  // on each forward so the content resubmits a re-forwarded query even though it
  // stays mounted (the drawer gets this for free by remounting per open).
  const [sidebarInitialQuery, setSidebarInitialQuery] = useState<string | undefined>(
    undefined
  );
  const [sidebarKey, setSidebarKey] = useState(0);
  const [sidebarPosition, setSidebarPosition] =
    useLocalStorageState<SeerExplorerSidebarPosition>(
      'seer-explorer-sidebar-position',
      'auto'
    );
  // Attached by `SeerExplorerSidebarLayout` to its measuring container so the
  // popped-out size sync can read the available width/height.
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const sidebarOrientation = useSeerExplorerSidebarOrientation(sidebarPosition);

  const isOpen = isSidebarMode ? isSidebarOpen : isDrawerOpen;

  const {getPageReferrer} = usePageReferrer();

  const {pipWindow, closePipWindow} = usePictureInPicture();
  const isPoppedOut = pipWindow !== null;

  // Re-open the active surface (sidebar or drawer) whenever the PiP window closes
  // (native controls, dock button, or programmatically) — unless a full close
  // was requested via `closeSeerExplorer`. The surface's size is kept in sync
  // continuously by `SyncSurfaceSizeFromPip`.
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
      if (isSidebarMode) {
        setIsSidebarOpen(true);
      } else {
        openSeerExplorerDrawer();
      }
    }
  }, [isPoppedOut, isSidebarMode, openSeerExplorerDrawer]);

  const openSeerExplorer = useCallback(
    (drawerOptions?: OpenSeerExplorerDrawerOptions) => {
      if (pipWindow) {
        pipWindow.focus();
        return;
      }
      if (isSidebarMode) {
        // Mirror `useSeerExplorerDrawer`'s option handling so deep links
        // (runId), the command palette (initialQuery), and session switching
        // behave the same in sidebar mode as in the drawer.
        const {runId: openRunId, startNewRun, initialQuery} = drawerOptions ?? {};
        if (initialQuery) {
          // Always start a fresh session so the query auto-submits into an empty
          // conversation, even if the sidebar is already open with a run. Bump
          // the nonce so re-forwarding the same query submits again.
          dispatch({type: 'set run id', payload: null});
          setSidebarKey(n => n + 1);
        } else if (isSidebarOpenRef.current) {
          return;
        } else if (openRunId !== undefined) {
          dispatch({type: 'set run id', payload: openRunId});
        } else if (startNewRun) {
          dispatch({type: 'set run id', payload: null});
        }
        setSidebarInitialQuery(initialQuery);
        setIsSidebarOpen(true);
        return;
      }
      openSeerExplorerDrawer(drawerOptions);
    },
    [pipWindow, isSidebarMode, dispatch, openSeerExplorerDrawer]
  );

  const closeSeerExplorer = useCallback(() => {
    if (pipWindow) {
      suppressRedockRef.current = true;
      closePipWindow();
      return;
    }
    if (isSidebarMode) {
      setIsSidebarOpen(false);
      // Tie the forwarded query to a single open lifecycle so a remount on
      // reopen (toggle / re-dock) doesn't auto-submit it again.
      setSidebarInitialQuery(undefined);
      setLastViewedAt(Date.now());
      return;
    }
    closeSeerExplorerDrawer();
  }, [pipWindow, isSidebarMode, closePipWindow, closeSeerExplorerDrawer]);

  const toggleSeerExplorer = useCallback(() => {
    if (pipWindow) {
      // Re-dock back into the active surface.
      closePipWindow();
      return;
    }
    if (isSidebarMode) {
      if (isSidebarOpen) {
        setLastViewedAt(Date.now());
        // Drop any forwarded query on close so reopening via toggle (which
        // forwards none) doesn't auto-submit a stale value.
        setSidebarInitialQuery(undefined);
      }
      setIsSidebarOpen(!isSidebarOpen);
      return;
    }
    toggleSeerExplorerDrawer();
  }, [pipWindow, isSidebarMode, isSidebarOpen, closePipWindow, toggleSeerExplorerDrawer]);

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
      isSidebarMode,
      openSeerExplorer,
      closeSeerExplorer,
      toggleSeerExplorer,
      sessionState,
      sidebarContainerRef,
      sidebarInitialQuery,
      sidebarKey,
      sidebarPosition,
      setSidebarPosition,
      unreadCount,
    }),
    [
      isOpen,
      isSidebarMode,
      openSeerExplorer,
      closeSeerExplorer,
      toggleSeerExplorer,
      sessionState,
      sidebarInitialQuery,
      sidebarKey,
      sidebarPosition,
      setSidebarPosition,
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
        <Fragment>
          {/* Persist the popped-out window's size to whichever surface is active
              so it is adopted on re-dock. Rendered in the main document (not the
              portal) since it only writes to localStorage. */}
          <SyncSurfaceSizeFromPip
            pipWindow={pipWindow}
            isSidebarMode={isSidebarMode}
            orientation={sidebarOrientation}
          />
          <PictureInPicturePortal pipWindow={pipWindow}>
            {/* Pop out the content of whichever surface is active: the decoupled
                sidebar content when the flag is on (there is no drawer then), or
                the drawer content otherwise. */}
            {isSidebarMode ? (
              <SeerExplorerContent
                key={sidebarKey}
                getPageReferrer={getPageReferrer}
                initialQuery={sidebarInitialQuery}
                onClose={closeSeerExplorer}
                sidebarPosition={sidebarPosition}
                onSidebarPositionChange={setSidebarPosition}
              />
            ) : (
              <ExplorerDrawerContent getPageReferrer={getPageReferrer} />
            )}
          </PictureInPicturePortal>
        </Fragment>
      )}
    </SeerExplorerContext.Provider>
  );
}

export function useSeerExplorerContext(): SeerExplorerContextValue {
  return useContext(SeerExplorerContext);
}
