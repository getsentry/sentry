import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import useAsciiSnapshot from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';
import {makeSeerExplorerQueryKey} from 'sentry/views/seerExplorer/utils';

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

const makeInitialSeerExplorerData = (): SeerExplorerResponse => ({
  session: null,
});

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
const isPolling = (sessionData: SeerExplorerResponse['session'], runStarted: boolean) => {
  if (!sessionData && !runStarted) {
    return false;
  }

  // Check if any PR is being created
  const anyPRCreating = Object.values(sessionData?.repo_pr_states ?? {}).some(
    state => state.pr_creation_status === 'creating'
  );

  return (
    !sessionData ||
    runStarted ||
    sessionData.status === 'processing' ||
    sessionData.blocks.some(message => message.loading) ||
    anyPRCreating
  );
};

export const useSeerExplorer = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;
  const captureAsciiSnapshot = useAsciiSnapshot();

  const [runId, setRunId] = useSessionStorage<number | null>(
    'seer-explorer-run-id',
    null
  );
  const [waitingForResponse, setWaitingForResponse] = useState<boolean>(false);
  const [deletedFromIndex, setDeletedFromIndex] = useState<number | null>(null);
  const [interruptRequested, setInterruptRequested] = useState<boolean>(false);
  const [optimistic, setOptimistic] = useState<{
    assistantBlockId: string;
    assistantContent: string;
    baselineSignature: string;
    insertIndex: number;
    userBlockId: string;
    userQuery: string;
  } | null>(null);
  const previousPRStatesRef = useRef<Record<string, RepoPRState>>({});

  const {data: apiData, isPending} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(orgSlug || '', runId || undefined),
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

  const sendMessage = useCallback(
    async (query: string, insertIndex?: number, explicitRunId?: number | null) => {
      if (!orgSlug) {
        return;
      }

      // explicitRunId: undefined = use current runId, null = force new run, number = use that run
      const effectiveRunId = explicitRunId === undefined ? runId : explicitRunId;

      // Capture a coarse ASCII screenshot of the user's screen for extra context
      const screenshot = captureAsciiSnapshot?.();

      setWaitingForResponse(true);

      // Calculate insert index first
      const effectiveMessageLength =
        deletedFromIndex ?? (apiData?.session?.blocks.length || 0);
      const calculatedInsertIndex = insertIndex ?? effectiveMessageLength;

      // Record current real blocks signature to know when to clear optimistic UI
      const baselineSignature = JSON.stringify(
        (apiData?.session?.blocks || []).map(b => [
          b.id,
          b.message.role,
          b.message.content,
          !!b.loading,
        ])
      );

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
        baselineSignature,
        userBlockId: generateBlockId('user', query, calculatedInsertIndex),
        assistantBlockId: generateBlockId(
          'loading',
          assistantContent || '',
          calculatedInsertIndex + 1
        ),
        assistantContent: assistantContent || 'Thinking...',
      });

      try {
        const response = (await api.requestPromise(
          `/organizations/${orgSlug}/seer/explorer-chat/${effectiveRunId ? `${effectiveRunId}/` : ''}`,
          {
            method: 'POST',
            data: {
              query,
              insert_index: calculatedInsertIndex,
              on_page_context: screenshot,
            },
          }
        )) as SeerExplorerChatResponse;

        // Set run ID if this is a new session
        if (!effectiveRunId) {
          setRunId(response.run_id);
        }

        // Invalidate queries to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, response.run_id),
        });
      } catch (e: any) {
        setWaitingForResponse(false);
        setOptimistic(null);
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug, effectiveRunId || undefined),
          makeErrorSeerExplorerData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [
      queryClient,
      api,
      orgSlug,
      runId,
      apiData,
      deletedFromIndex,
      captureAsciiSnapshot,
      setRunId,
    ]
  );

  const deleteFromIndex = useCallback((index: number) => {
    setDeletedFromIndex(index);
  }, []);

  const interruptRun = useCallback(async () => {
    if (!orgSlug || !runId || interruptRequested) {
      return;
    }

    setInterruptRequested(true);

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
      setInterruptRequested(false);
    }
  }, [api, orgSlug, runId, interruptRequested]);

  const respondToUserInput = useCallback(
    async (inputId: string, responseData?: Record<string, any>) => {
      if (!orgSlug || !runId) {
        return;
      }

      setWaitingForResponse(true);

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
        setWaitingForResponse(false);
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug, runId),
          makeErrorSeerExplorerData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [api, orgSlug, runId, queryClient]
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

  // Always filter messages based on optimistic state and deletedFromIndex before any other processing
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

      const baseSession: NonNullable<SeerExplorerResponse['session']> = sessionData ?? {
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

  // Clear optimistic blocks once the real blocks change in poll results
  useEffect(() => {
    if (optimistic) {
      const currentSignature = JSON.stringify(
        (apiData?.session?.blocks || []).map(b => [
          b.id,
          b.message.role,
          b.message.content,
          !!b.loading,
        ])
      );
      if (currentSignature !== optimistic.baselineSignature) {
        setOptimistic(null);
        // Reveal all real blocks immediately after the server responds
        setDeletedFromIndex(null);
      }
    }
  }, [apiData?.session?.blocks, optimistic]);

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

  if (
    waitingForResponse &&
    filteredSessionData &&
    Array.isArray(filteredSessionData.blocks)
  ) {
    // Stop waiting once we see the response is no longer loading
    const hasLoadingMessage = filteredSessionData.blocks.some(block => block.loading);

    if (!hasLoadingMessage && filteredSessionData.status !== 'processing') {
      setWaitingForResponse(false);
      setInterruptRequested(false);
      // Clear deleted index once response is complete
      setDeletedFromIndex(null);
    }
  }

  // Reset interruptRequested when polling stops after an interrupt was requested
  useEffect(() => {
    if (interruptRequested && !isPolling(filteredSessionData, waitingForResponse)) {
      setInterruptRequested(false);
    }
  }, [interruptRequested, filteredSessionData, waitingForResponse]);

  /** Resets the hook state. The session isn't actually created until the user sends a message. */
  const startNewSession = useCallback(() => {
    if (!interruptRequested && isPolling(filteredSessionData, waitingForResponse)) {
      // Make interrupt request before resetting state.
      interruptRun();
    }
    // Reset state.
    setRunId(null);
    setWaitingForResponse(false);
    setDeletedFromIndex(null);
    setOptimistic(null);
    setInterruptRequested(false);
    if (orgSlug) {
      setApiQueryData<SeerExplorerResponse>(
        queryClient,
        makeSeerExplorerQueryKey(orgSlug),
        makeInitialSeerExplorerData()
      );
    }
  }, [
    queryClient,
    orgSlug,
    setRunId,
    filteredSessionData,
    waitingForResponse,
    interruptRun,
    interruptRequested,
  ]);

  /** Switches to a different run and fetches its latest state. */
  const switchToRun = useCallback(
    (newRunId: number) => {
      // Clear any optimistic state from previous run
      setOptimistic(null);
      setDeletedFromIndex(null);
      setWaitingForResponse(false);
      setInterruptRequested(false);

      // Set the new run ID
      setRunId(newRunId);

      // Invalidate the query to force a fresh fetch
      if (orgSlug) {
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, newRunId),
        });
      }
    },
    [orgSlug, queryClient, setRunId]
  );

  return {
    sessionData: filteredSessionData,
    isPolling: isPolling(filteredSessionData, waitingForResponse),
    isPending,
    sendMessage,
    runId,
    setRunId,
    /** Switches to a different run and fetches its latest state. */
    switchToRun,
    /** Resets the run id, blocks, and other state. The new session isn't actually created until the user sends a message. */
    startNewSession,
    deleteFromIndex,
    deletedFromIndex,
    interruptRun,
    interruptRequested,
    respondToUserInput,
    createPR,
  };
};
