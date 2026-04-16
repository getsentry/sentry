import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {useTimeout} from 'sentry/utils/useTimeout';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {useAsciiSnapshot} from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {
  makeSeerExplorerQueryKey,
  RUN_ID_QUERY_PARAM,
  usePageReferrer,
} from 'sentry/views/seerExplorer/utils';

export type PendingUserInput = {
  data: Record<string, any>;
  id: string;
  input_type: 'file_change_approval' | 'ask_user_question';
};

export type SeerExplorerResponse = {
  session: {
    blocks: Block[];
    status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
    updated_at: string;
    owner_user_id?: number | null;
    pending_user_input?: PendingUserInput | null;
    repo_pr_states?: Record<string, RepoPRState>;
    run_id?: number;
  } | null;
};

type SeerExplorerChatResponse = {
  message: Block;
  run_id: number;
};

const POLL_INTERVAL = 500; // Poll every 500ms
const POLLING_TIMEOUT_MS = 420_000; // 7 minutes

/** Routes where the LLMContext tree provides structured page context. */
const STRUCTURED_CONTEXT_ROUTES = new Set(['/dashboard/:dashboardId/']);

const OPTIMISTIC_ASSISTANT_TEXTS = [
  'Looking around...',
  'One sec...',
  'Following breadcrumbs...',
  'Onboarding...',
  'Hold tight...',
  'Gathering threads...',
  'Tracing the answer...',
  'Stacking ideas...',
  'Profiling your project...',
  'Span by span...',
  'Rolling logs...',
  'Replaying prod...',
  'Scanning the error-waves...',
] as const;

const makeErrorSeerExplorerData = (errorMessage: string): SeerExplorerResponse => ({
  session: {
    run_id: undefined,
    blocks: [
      {
        id: 'error',
        message: {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
        timestamp: new Date().toISOString(),
        loading: false,
      },
    ],
    status: 'error',
    updated_at: new Date().toISOString(),
  },
});

/** Determines if we should poll for updates */
const isPolling = (
  sessionData: SeerExplorerResponse['session'],
  waitingForResponse: boolean
) => {
  // Check if any PR is being created
  const anyPRCreating = Object.values(sessionData?.repo_pr_states ?? {}).some(
    state => state.pr_creation_status === 'creating'
  );

  return anyPRCreating || waitingForResponse;
};

export const useSeerExplorer = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;
  const captureAsciiSnapshot = useAsciiSnapshot();
  const {getLLMContext} = useLLMContext();
  const [overrideCtxEngEnable, setOverrideCtxEngEnable] = useState<boolean>(true);

  const [runId, setRunId] = useSessionStorage<number | null>(
    'seer-explorer-run-id',
    null
  );

  // Support deep links that carry a run id; set it once and clean the URL.
  const {openExplorerPanel} = useExplorerPanel();
  const {getPageReferrer} = usePageReferrer();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const paramValue = location.query?.[RUN_ID_QUERY_PARAM];
    if (typeof paramValue !== 'string') {
      return;
    }
    const parsedRunId = Number(paramValue);
    if (!Number.isNaN(parsedRunId)) {
      openExplorerPanel();
      setRunId(parsedRunId);
      const {[RUN_ID_QUERY_PARAM]: _removed, ...restQuery} = location.query ?? {};
      navigate({...location, query: restQuery}, {replace: true});
    }
  }, [location, navigate, openExplorerPanel, setRunId]);

  const [waitingForResponse, setWaitingForResponse] = useState<boolean>(false);
  const [waitingForInterrupt, setWaitingForInterrupt] = useState<boolean>(false);

  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);
  const {start: startPollingTimeout, cancel: cancelPollingTimeout} = useTimeout({
    timeMs: POLLING_TIMEOUT_MS,
    onTimeout: () => {
      setIsTimedOut(true);
    },
  });

  // Helpers for managing waiting and interrupt state.
  const _onNewRequest = useCallback(() => {
    setWaitingForResponse(true);
    setWaitingForInterrupt(false);
    setIsTimedOut(false);
    startPollingTimeout();
  }, [startPollingTimeout]);

  const _onRequestError = useCallback(() => {
    setWaitingForResponse(false);
    setWaitingForInterrupt(false);
    setIsTimedOut(false);
    cancelPollingTimeout();
  }, [cancelPollingTimeout]);

  const [deletedFromIndex, setDeletedFromIndex] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<{
    assistantBlockId: string;
    assistantContent: string;
    baselineUpdatedAt: string | undefined;
    insertIndex: number;
    userBlockId: string;
    userQuery: string;
  } | null>(null);
  const previousPRStatesRef = useRef<Record<string, RepoPRState>>({});

  const {data: apiData, isError} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(orgSlug || '', runId),
    {
      staleTime: 0,
      retry: false,
      enabled: !!runId && !!orgSlug,
      refetchInterval: query => {
        if (isPolling(query.state.data?.[0]?.session || null, waitingForResponse)) {
          return POLL_INTERVAL;
        }
        return false;
      },
    } as UseApiQueryOptions<SeerExplorerResponse, RequestError>
  );

  /** Switches to a different run and fetches its latest state. */
  const switchToRun = useCallback(
    (newRunId: number | null) => {
      // Set the new run ID
      setRunId(newRunId);

      // Clear any optimistic state from previous run
      setOptimistic(null);
      setDeletedFromIndex(null);
      setWaitingForResponse(false);
      setWaitingForInterrupt(false);
      setIsTimedOut(false);
      cancelPollingTimeout();

      // Invalidate the query to force a fresh fetch
      if (orgSlug && newRunId !== null) {
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, newRunId),
        });
      }
    },
    [orgSlug, queryClient, setRunId, cancelPollingTimeout]
  );

  /** Resets the hook state. The session isn't actually created until the user sends a message. */
  const startNewSession = useCallback(() => switchToRun(null), [switchToRun]);

  const sendMessage = useCallback(
    async (query: string, insertIndex?: number, explicitRunId?: number | null) => {
      if (!orgSlug) {
        return;
      }

      // explicitRunId: undefined = use current runId, null = force new run, number = use that run
      const effectiveRunId = explicitRunId === undefined ? runId : explicitRunId;

      // Send structured LLMContext JSON on supported pages when the feature flag
      // is enabled; fall back to a coarse ASCII screenshot otherwise.
      let screenshot: string | undefined;
      if (
        STRUCTURED_CONTEXT_ROUTES.has(getPageReferrer()) &&
        organization?.features.includes('context-engine-structured-page-context')
      ) {
        try {
          screenshot = JSON.stringify(getLLMContext());
        } catch (e) {
          Sentry.captureException(e);
          screenshot = captureAsciiSnapshot?.();
        }
      } else {
        screenshot = captureAsciiSnapshot?.();
      }

      trackAnalytics('seer.explorer.message_sent', {
        referrer: getPageReferrer(),
        surface: 'global_panel',
        organization,
      });

      if (effectiveRunId === null) {
        trackAnalytics('seer.explorer.session_created', {
          referrer: getPageReferrer(),
          surface: 'global_panel',
          organization,
        });
      }

      // Calculate insert index first
      const effectiveMessageLength =
        deletedFromIndex ?? (apiData?.session?.blocks.length || 0);
      const calculatedInsertIndex = insertIndex ?? effectiveMessageLength;

      // Generate deterministic block IDs matching backend logic
      // Backend generates: `{prefix}-{index}-{content[:16].replace(' ', '-')}`
      const generateBlockId = (prefix: string, content: string, index: number) => {
        const contentPrefix = content.slice(0, 16).replace(/ /g, '-');
        return `${prefix}-${index}-${contentPrefix}`;
      };

      // Set optimistic UI: show user's message and a thinking placeholder,
      // and hide all real blocks after the insert point.
      const assistantContent =
        OPTIMISTIC_ASSISTANT_TEXTS[
          Math.floor(Math.random() * OPTIMISTIC_ASSISTANT_TEXTS.length)
        ];
      setOptimistic({
        insertIndex: calculatedInsertIndex,
        userQuery: query,
        userBlockId: generateBlockId('user', query, calculatedInsertIndex),
        assistantBlockId: generateBlockId(
          'loading',
          assistantContent || '',
          calculatedInsertIndex + 1
        ),
        assistantContent: assistantContent || 'Thinking...',
        baselineUpdatedAt: apiData?.session?.updated_at,
      });

      _onNewRequest();

      try {
        const {url} = parseQueryKey(makeSeerExplorerQueryKey(orgSlug, effectiveRunId));
        const response = (await api.requestPromise(url, {
          method: 'POST',
          data: {
            query,
            insert_index: calculatedInsertIndex,
            on_page_context: screenshot,
            page_name: getPageReferrer(),
            override_ce_enable: overrideCtxEngEnable,
          },
        })) as SeerExplorerChatResponse;

        // Set run ID if this is a new session
        if (!effectiveRunId) {
          setRunId(response.run_id);
        }

        // Invalidate queries to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, response.run_id),
        });
      } catch (e: any) {
        _onRequestError();
        setOptimistic(null);
        if (effectiveRunId !== null) {
          // API data is disabled for null runId (new runs).
          setApiQueryData<SeerExplorerResponse>(
            queryClient,
            makeSeerExplorerQueryKey(orgSlug, effectiveRunId),
            makeErrorSeerExplorerData(e?.responseJSON?.detail ?? 'An error occurred')
          );
        }
        addErrorMessage(e?.responseJSON?.detail ?? 'Failed to send message');
      }
    },
    [
      _onNewRequest,
      _onRequestError,
      queryClient,
      api,
      orgSlug,
      runId,
      apiData,
      deletedFromIndex,
      captureAsciiSnapshot,
      getLLMContext,
      setRunId,
      getPageReferrer,
      organization,
      overrideCtxEngEnable,
    ]
  );

  const deleteFromIndex = useCallback(
    (index: number) => {
      setDeletedFromIndex(index);
      trackAnalytics('seer.explorer.rethink_requested', {organization});
    },
    [organization]
  );

  const interruptRun = useCallback(async () => {
    if (!orgSlug || !runId || waitingForInterrupt) {
      return;
    }

    setWaitingForInterrupt(true);

    try {
      await api.requestPromise(
        `/organizations/${orgSlug}/seer/explorer-update/${runId}/`,
        {
          method: 'POST',
          data: {
            payload: {
              type: 'interrupt',
            },
          },
        }
      );
    } catch (e: any) {
      // If the request fails, reset the interrupt state
      setWaitingForInterrupt(false);
    }
  }, [api, orgSlug, runId, waitingForInterrupt]);

  const respondToUserInput = useCallback(
    async (inputId: string, responseData?: Record<string, any>) => {
      if (!orgSlug || !runId) {
        return;
      }

      _onNewRequest();

      try {
        await api.requestPromise(
          `/organizations/${orgSlug}/seer/explorer-update/${runId}/`,
          {
            method: 'POST',
            data: {
              payload: {
                type: 'user_input_response',
                input_id: inputId,
                response_data: responseData,
              },
            },
          }
        );

        // Invalidate queries to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, runId),
        });
      } catch (e: any) {
        _onRequestError();
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug, runId),
          makeErrorSeerExplorerData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [_onNewRequest, _onRequestError, api, orgSlug, runId, queryClient]
  );

  const createPR = useCallback(
    async (repoName?: string) => {
      if (!orgSlug || !runId) {
        return;
      }

      try {
        await api.requestPromise(
          `/organizations/${orgSlug}/seer/explorer-update/${runId}/`,
          {
            method: 'POST',
            data: {
              payload: {
                type: 'create_pr',
                repo_name: repoName,
              },
            },
          }
        );

        // Invalidate queries to trigger polling for status updates
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, runId),
        });
      } catch (e: any) {
        addErrorMessage(e?.responseJSON?.detail ?? 'Failed to create PR');
      }
    },
    [api, orgSlug, runId, queryClient]
  );

  // Apply deletedFromIndex and optimistic state before any other processing
  const sessionData = apiData?.session ?? null;

  const filteredSessionData = useMemo(() => {
    const realBlocks = sessionData?.blocks || [];

    // Respect rewound/deleted index first for the real blocks view
    const baseBlocks =
      deletedFromIndex === null ? realBlocks : realBlocks.slice(0, deletedFromIndex);

    if (optimistic) {
      const insert = Math.min(Math.max(optimistic.insertIndex, 0), baseBlocks.length);

      const optimisticUserBlock: Block = {
        id: optimistic.userBlockId,
        message: {role: 'user', content: optimistic.userQuery},
        timestamp: new Date().toISOString(),
        loading: false,
      };

      const optimisticThinkingBlock: Block = {
        id: optimistic.assistantBlockId,
        message: {role: 'assistant', content: optimistic.assistantContent},
        timestamp: new Date().toISOString(),
        loading: true,
      };

      const visibleBlocks = [
        ...baseBlocks.slice(0, insert),
        optimisticUserBlock,
        optimisticThinkingBlock,
      ];

      const baseSession = sessionData ?? {
        run_id: runId ?? undefined,
        blocks: [],
        status: 'processing',
        updated_at: new Date().toISOString(),
      };

      return {
        ...baseSession,
        blocks: visibleBlocks,
        status: 'processing',
      } as NonNullable<typeof sessionData>;
    }

    if (sessionData && deletedFromIndex !== null) {
      return {
        ...sessionData,
        blocks: baseBlocks,
      } as NonNullable<typeof sessionData>;
    }

    return sessionData;
  }, [sessionData, deletedFromIndex, optimistic, runId]);

  // On partial response load - clear optimistic blocks and deletedFromIndex once the server has
  // persisted the user message and produced a real assistant response after the insert point.
  useEffect(() => {
    if (!optimistic || apiData?.session?.updated_at === optimistic.baselineUpdatedAt) {
      return;
    }

    const serverBlocks = apiData?.session?.blocks || [];
    const blockAtInsert = serverBlocks[optimistic.insertIndex];

    const serverHasUserBlock =
      blockAtInsert?.message.role === 'user' &&
      blockAtInsert?.message.content === optimistic.userQuery;

    if (!serverHasUserBlock) {
      return;
    }

    const hasAssistantResponse = serverBlocks
      .slice(optimistic.insertIndex + 1)
      .some(b => b.message.role === 'assistant');

    if (hasAssistantResponse) {
      setOptimistic(null);
      setDeletedFromIndex(null);
    }
  }, [apiData?.session?.blocks, apiData?.session?.updated_at, optimistic]);

  // On full response load or timeout
  const isLoaded =
    filteredSessionData &&
    filteredSessionData.status !== 'processing' &&
    filteredSessionData.blocks.every((block: Block) => !block.loading);

  useEffect(() => {
    if (isLoaded || isTimedOut) {
      // Reset waiting state and timeout
      setWaitingForResponse(false);
      cancelPollingTimeout();

      if (waitingForInterrupt) {
        // Clear waiting for interrupt state and set persistent UI flag until next request
        setWaitingForInterrupt(false);
      }
    }
  }, [
    waitingForResponse,
    waitingForInterrupt,
    isLoaded,
    isTimedOut,
    cancelPollingTimeout,
  ]);

  // Detect PR creation errors and show error messages
  useEffect(() => {
    const currentPRStates = sessionData?.repo_pr_states ?? {};
    const previousPRStates = previousPRStatesRef.current;

    // Check each repo for errors
    for (const [repoName, currentState] of Object.entries(currentPRStates)) {
      const previousState = previousPRStates[repoName];

      // Detect transition from 'creating' to 'error'
      if (
        previousState?.pr_creation_status === 'creating' &&
        currentState.pr_creation_status === 'error' &&
        currentState.pr_creation_error
      ) {
        addErrorMessage(currentState.pr_creation_error ?? 'Failed to create PR');
      }
    }

    previousPRStatesRef.current = currentPRStates;
  }, [sessionData?.repo_pr_states]);

  return {
    sessionData: filteredSessionData,
    isPolling: isPolling(filteredSessionData, waitingForResponse),
    isError,
    isTimedOut,
    sendMessage,
    runId,
    /** Switches to a different run and fetches its latest state. */
    switchToRun,
    /** Resets the run id, blocks, and other state. The new session isn't actually created until the user sends a message. */
    startNewSession,
    deleteFromIndex,
    deletedFromIndex,
    interruptRun,
    waitingForInterrupt,
    respondToUserInput,
    createPR,
    overrideCtxEngEnable,
    setOverrideCtxEngEnable,
  };
};
