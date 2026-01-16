import {useCallback, useEffect, useRef, useState} from 'react';

import {toggleSeerExplorerPanel} from 'sentry/views/seerExplorer/utils';

/**
 * Utilities for programmatically opening the Seer Explorer panel from anywhere in the app.
 *
 * This uses a custom DOM event to communicate with the ExplorerPanel without requiring
 * context changes to the App component.
 */

type OpenSeerExplorerOptions = {
  /**
   * Optional initial message to send when opening the explorer.
   * If provided with `startNewRun: true`, a new run will be started with this message.
   * If provided with a `runId`, the message will be sent to that existing run.
   */
  initialMessage?: string;
  /**
   * Callback invoked when a new run is created from this action.
   * Useful for storing the run ID so subsequent opens can reference the same chat.
   */
  onRunCreated?: (runId: number) => void;
  /**
   * Optional run ID to open. If provided, opens an existing session.
   * Cannot be used together with `startNewRun`.
   */
  runId?: number;
  /**
   * If true, starts a new run (clears any existing session).
   * Cannot be used together with `runId`.
   */
  startNewRun?: boolean;
};

const SEER_EXPLORER_OPEN_EVENT = 'seer-explorer:open';
const SEER_EXPLORER_RUN_CREATED_EVENT = 'seer-explorer:run-created';
const SEER_EXPLORER_SESSION_READY_EVENT = 'seer-explorer:session-ready';

/**
 * Custom event for opening the Seer Explorer panel with options.
 */
class SeerExplorerOpenEvent extends CustomEvent<OpenSeerExplorerOptions> {
  constructor(options: OpenSeerExplorerOptions = {}) {
    super(SEER_EXPLORER_OPEN_EVENT, {
      detail: options,
      bubbles: true,
    });
  }
}

/**
 * Custom event dispatched when a new run is created.
 */
class SeerExplorerRunCreatedEvent extends CustomEvent<{runId: number}> {
  constructor(runId: number) {
    super(SEER_EXPLORER_RUN_CREATED_EVENT, {
      detail: {runId},
      bubbles: true,
    });
  }
}

/**
 * Custom event dispatched when a session has data ready (first poll completed).
 */
class SeerExplorerSessionReadyEvent extends CustomEvent<{runId: number}> {
  constructor(runId: number) {
    super(SEER_EXPLORER_SESSION_READY_EVENT, {
      detail: {runId},
      bubbles: true,
    });
  }
}

/**
 * Opens the Seer Explorer panel programmatically.
 *
 * @example
 * // Just open the panel
 * openSeerExplorer();
 *
 * @example
 * // Start a new run with an initial message
 * openSeerExplorer({
 *   startNewRun: true,
 *   initialMessage: 'Help me investigate this cluster of issues',
 * });
 *
 * @example
 * // Open an existing run
 * openSeerExplorer({ runId: 123 });
 *
 * @example
 * // Start a new run and track the created run ID
 * openSeerExplorer({
 *   startNewRun: true,
 *   initialMessage: 'Investigate this',
 *   onRunCreated: (runId) => {
 *     // Store runId for future reference
 *     setSavedRunId(runId);
 *   },
 * });
 */
export function openSeerExplorer(options: OpenSeerExplorerOptions = {}): void {
  document.dispatchEvent(new SeerExplorerOpenEvent(options));
}

interface UseExternalOpenOptions {
  isVisible: boolean;
  sendMessage: (
    query: string,
    insertIndex?: number,
    explicitRunId?: number | null
  ) => void;
  sessionBlocks: unknown[] | undefined;
  sessionRunId: number | undefined;
  startNewSession: () => void;
  switchToRun: (runId: number) => void;
  /**
   * Callback to un-minimize the panel when it's already open but minimized.
   */
  onUnminimize?: () => void;
}

/**
 * Hook to handle external open events for the Seer Explorer panel.
 * Manages pending options, run creation callbacks, and session ready events.
 */
export function useExternalOpen({
  isVisible,
  sendMessage,
  startNewSession,
  switchToRun,
  sessionRunId,
  sessionBlocks,
  onUnminimize,
}: UseExternalOpenOptions) {
  const pendingOptionsRef = useRef<OpenSeerExplorerOptions | null>(null);
  const onRunCreatedRef = useRef<((runId: number) => void) | null>(null);
  const prevRunIdRef = useRef<number | null | undefined>(undefined);
  const [isWaitingForSessionData, setIsWaitingForSessionData] = useState(false);

  const processPendingOptions = useCallback(
    (options: OpenSeerExplorerOptions) => {
      const {startNewRun, runId: optionsRunId, initialMessage, onRunCreated} = options;

      if (onRunCreated) {
        onRunCreatedRef.current = onRunCreated;
      }

      if (startNewRun) {
        startNewSession();
        if (initialMessage) {
          setIsWaitingForSessionData(true);
          sendMessage(initialMessage, undefined, null);
        }
      } else if (optionsRunId !== undefined) {
        switchToRun(optionsRunId);
        if (initialMessage) {
          sendMessage(initialMessage, undefined, optionsRunId);
        }
      } else if (initialMessage) {
        sendMessage(initialMessage, undefined);
      }
    },
    [startNewSession, switchToRun, sendMessage]
  );

  // Listen for external open events
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const customEvent = event as CustomEvent<OpenSeerExplorerOptions>;
      const options = customEvent.detail;

      pendingOptionsRef.current = options;

      if (isVisible) {
        // Panel is already open - un-minimize and process immediately
        onUnminimize?.();
        const storedOptions = pendingOptionsRef.current;
        pendingOptionsRef.current = null;
        processPendingOptions(storedOptions);
      } else {
        // Panel is closed - open it, then the visibility effect will process options
        toggleSeerExplorerPanel();
      }
    };

    document.addEventListener(SEER_EXPLORER_OPEN_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener(SEER_EXPLORER_OPEN_EVENT, handleOpenEvent);
    };
  }, [isVisible, onUnminimize, processPendingOptions]);

  // Handle pending options when the panel becomes visible
  useEffect(() => {
    if (!isVisible || !pendingOptionsRef.current) {
      return;
    }

    const options = pendingOptionsRef.current;
    pendingOptionsRef.current = null;
    processPendingOptions(options);
  }, [isVisible, processPendingOptions]);

  // Call the onRunCreated callback when a new run ID is set
  useEffect(() => {
    if (
      sessionRunId !== undefined &&
      sessionRunId !== null &&
      prevRunIdRef.current !== sessionRunId &&
      onRunCreatedRef.current
    ) {
      onRunCreatedRef.current(sessionRunId);
      document.dispatchEvent(new SeerExplorerRunCreatedEvent(sessionRunId));
      onRunCreatedRef.current = null;
    }
    prevRunIdRef.current = sessionRunId;
  }, [sessionRunId]);

  // Clear loading state when we first get blocks after a new run
  useEffect(() => {
    const hasBlocks = sessionBlocks && sessionBlocks.length > 0;

    if (isWaitingForSessionData && sessionRunId && hasBlocks) {
      document.dispatchEvent(new SeerExplorerSessionReadyEvent(sessionRunId));
      setIsWaitingForSessionData(false);
    }
  }, [sessionRunId, sessionBlocks, isWaitingForSessionData]);

  return {isWaitingForSessionData};
}
