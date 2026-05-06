import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {fetchMutation, setApiQueryData} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {useAsciiSnapshot} from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';
import {
  isSessionComplete,
  useSeerExplorerPolling,
} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import {useSeerExplorerRunId} from 'sentry/views/seerExplorer/hooks/useSeerExplorerRunId';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';
import {makeSeerExplorerQueryKey, usePageReferrer} from 'sentry/views/seerExplorer/utils';

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

type SeerExplorerUpdateResponse = {
  run_id: number;
};

/** Routes where the LLMContext tree provides structured page context. */
const STRUCTURED_CONTEXT_ROUTES = new Set([
  '/dashboard/:dashboardId/',
  '/dashboard/:dashboardId/widget-builder/widget/new/',
  '/dashboard/:dashboardId/widget-builder/widget/:widgetIndex/edit/',
  '/explore/traces/',
  '/explore/traces/trace/:traceSlug/',
  '/issues/',
  '/issues/:groupId/',
]);
/** New experimental routes where the LLMContext tree provides structured page context. */
const NEW_STRUCTURED_CONTEXT_ROUTES = new Set<string>([
  '/issues/:groupId/events/',
  '/issues/:groupId/events/:eventId/',
]);

function supportsStructuredContext(
  referrer: string,
  organization: {features: string[]} | null | undefined
): boolean {
  return (
    (STRUCTURED_CONTEXT_ROUTES.has(referrer) &&
      organization?.features.includes('seer-explorer-context-engine') === true) ||
    (NEW_STRUCTURED_CONTEXT_ROUTES.has(referrer) &&
      organization?.features.includes('context-engine-structured-page-context') === true)
  );
}

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

export const useSeerExplorer = () => {
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;
  const captureAsciiSnapshot = useAsciiSnapshot();
  const {getLLMContext} = useLLMContext();
  const [overrideCtxEngEnable, setOverrideCtxEngEnable] = useLocalStorageState(
    'seer-explorer.override.ctx-eng',
    true
  );
  type CodeModeValue = 'off' | 'on' | 'only';
  const [overrideCodeModeEnable, setOverrideCodeModeEnable] =
    useLocalStorageState<CodeModeValue>(
      'seer-explorer.override.code-mode',
      (storedValue?: unknown): CodeModeValue => {
        if (storedValue === 'off' || storedValue === 'on' || storedValue === 'only') {
          return storedValue;
        }
        // Migrate legacy boolean values
        if (storedValue === true) {
          return 'on';
        }
        if (storedValue === false) {
          return 'off';
        }
        return 'on'; // default
      }
    );

  const [runId, setRunId] = useSeerExplorerRunId();

  const {getPageReferrer} = usePageReferrer();

  const [waitingForInterrupt, setWaitingForInterrupt] = useState(false);
  const [optimistic, setOptimistic] = useState<{
    assistantBlockId: string;
    assistantContent: string;
    baselineUpdatedAt: string | undefined;
    insertIndex: number;
    userBlockId: string;
    userQuery: string;
  } | null>(null);
  const previousPRStatesRef = useRef<Record<string, RepoPRState>>({});

  // Queries and mutations
  const {mutate: sendMessageMutate, isPending: isPendingSendMessage} = useMutation<
    SeerExplorerChatResponse,
    RequestError,
    {
      insertIndex: number;
      orgSlug: string;
      overrideCodeModeEnable: 'off' | 'on' | 'only';
      overrideCtxEngEnable: boolean;
      pageName: string;
      query: string;
      runId: number | null;
      screenshot: string | undefined;
    }
  >({
    mutationFn: async params => {
      setWaitingForInterrupt(false);
      const {url} = parseQueryKey(
        makeSeerExplorerQueryKey(params.orgSlug ?? '', params.runId)
      );
      return fetchMutation({
        url,
        method: 'POST',
        data: {
          query: params.query,
          insert_index: params.insertIndex,
          on_page_context: params.screenshot,
          page_name: params.pageName,
          override_ce_enable: params.overrideCtxEngEnable,
          override_code_mode_enable: params.overrideCodeModeEnable,
        },
      });
    },
    onSuccess: (response, params) => {
      if (params.runId) {
        // invalidate the query so fresh data is fetched
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(params.orgSlug ?? '', params.runId),
        });
      } else {
        // set run ID if this is a new session
        setRunId(response.run_id);
      }
    },
    onError: (e, params) => {
      setWaitingForInterrupt(false);
      setOptimistic(null);
      if (params.runId !== null) {
        // API data is disabled for null runId (new runs).
        // Will be fixed soon when we get rid of setApiQueryData.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(params.orgSlug, params.runId),
          makeErrorSeerExplorerData('An error occurred')
        );
      }
      addErrorMessage(
        typeof e.responseJSON?.detail === 'string'
          ? e.responseJSON.detail
          : 'Failed to send message'
      );
    },
  });

  const {mutate: userInputMutate, isPending: isPendingUserInput} = useMutation<
    SeerExplorerUpdateResponse,
    RequestError,
    {
      inputId: string;
      orgSlug: string;
      runId: number | null;
      responseData?: Record<string, any>;
    }
  >({
    mutationFn: async params => {
      setWaitingForInterrupt(false);
      return fetchMutation({
        url: `/organizations/${params.orgSlug}/seer/explorer-update/${params.runId}/`,
        method: 'POST',
        data: {
          payload: {
            type: 'user_input_response',
            input_id: params.inputId,
            response_data: params.responseData,
          },
        },
      });
    },
    onSuccess: (_, params) => {
      // invalidate the query so fresh data is fetched
      queryClient.invalidateQueries({
        queryKey: makeSeerExplorerQueryKey(params.orgSlug ?? '', params.runId),
      });
    },
    onError: (e, params) => {
      setWaitingForInterrupt(false);
      if (params.runId !== null) {
        // API data is disabled for null runId (new runs).

        // Will be fixed soon when we get rid of setApiQueryData.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(params.orgSlug, params.runId),
          makeErrorSeerExplorerData('An error occurred')
        );
      }
      addErrorMessage(
        typeof e.responseJSON?.detail === 'string'
          ? e.responseJSON.detail
          : 'Failed to send user input'
      );
    },
  });

  const {mutate: createPRMutate, isPending: isPendingCreatePR} = useMutation<
    SeerExplorerUpdateResponse,
    RequestError,
    {orgSlug: string; runId: number | null; repoName?: string}
  >({
    mutationFn: async params => {
      setWaitingForInterrupt(false);
      return fetchMutation({
        url: `/organizations/${params.orgSlug}/seer/explorer-update/${params.runId}/`,
        method: 'POST',
        data: {
          payload: {
            type: 'create_pr',
            repo_name: params.repoName,
          },
        },
      });
    },
    onSuccess: (_, params) => {
      // invalidate the query so fresh data is fetched
      queryClient.invalidateQueries({
        queryKey: makeSeerExplorerQueryKey(params.orgSlug ?? '', params.runId),
      });
    },
    onError: e => {
      setWaitingForInterrupt(false);
      addErrorMessage(
        typeof e.responseJSON?.detail === 'string'
          ? e.responseJSON.detail
          : 'Failed to create PR'
      );
    },
  });

  const {mutate: interruptRunMutate} = useMutation<
    SeerExplorerUpdateResponse,
    RequestError,
    {
      orgSlug: string;
      runId: number | null;
    }
  >({
    mutationFn: async params => {
      return fetchMutation({
        url: `/organizations/${params.orgSlug}/seer/explorer-update/${params.runId}/`,
        method: 'POST',
        data: {
          payload: {
            type: 'interrupt',
          },
        },
      });
    },
    onError: () => {
      setWaitingForInterrupt(false);
      addErrorMessage('Failed to interrupt');
    },
  });

  const isMutatePending = isPendingSendMessage || isPendingUserInput || isPendingCreatePR;

  const {apiData, isPolling, isError, errorStatusCode} = useSeerExplorerPolling({
    runId,
    isMutatePending,
  });

  /** Switches to a different run and fetches its latest state. */
  const switchToRun = useCallback(
    (newRunId: number | null) => {
      if (newRunId === runId) {
        return;
      }

      // Set the new run ID
      setRunId(newRunId);

      // Clear any optimistic state from previous run
      setOptimistic(null);
      setWaitingForInterrupt(false);

      // Invalidate the query to force a fresh fetch
      if (orgSlug && newRunId !== null) {
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, newRunId),
        });
      }
    },
    [orgSlug, queryClient, runId, setRunId]
  );

  /** Resets the hook state. The session isn't actually created until the user sends a message. */
  const startNewSession = useCallback(() => switchToRun(null), [switchToRun]);

  const sendMessage = useCallback(
    (query: string, insertIndex?: number, explicitRunId?: number | null) => {
      if (!orgSlug) {
        return;
      }

      // explicitRunId: undefined = use current runId, null = force new run, number = use that run
      const effectiveRunId = explicitRunId === undefined ? runId : explicitRunId;

      // Send structured LLMContext JSON on supported pages when the feature flag
      // is enabled; fall back to a coarse ASCII screenshot otherwise.
      let screenshot: string | undefined;
      if (
        overrideCtxEngEnable &&
        supportsStructuredContext(getPageReferrer(), organization)
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

      const pageName = getPageReferrer();

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
      const effectiveMessageLength = apiData?.session?.blocks.length || 0;
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

      sendMessageMutate({
        query,
        insertIndex: calculatedInsertIndex,
        runId: effectiveRunId,
        orgSlug,
        pageName,
        screenshot,
        overrideCtxEngEnable,
        overrideCodeModeEnable,
      });
    },
    [
      orgSlug,
      runId,
      apiData,
      captureAsciiSnapshot,
      getLLMContext,
      getPageReferrer,
      organization,
      overrideCtxEngEnable,
      overrideCodeModeEnable,
      sendMessageMutate,
    ]
  );

  const interruptRun = useCallback(() => {
    if (!orgSlug || !runId || waitingForInterrupt) {
      return;
    }
    setWaitingForInterrupt(true);
    interruptRunMutate({orgSlug, runId});
  }, [orgSlug, runId, waitingForInterrupt, interruptRunMutate]);

  const respondToUserInput = useCallback(
    (inputId: string, responseData?: Record<string, any>) => {
      if (!orgSlug || !runId) {
        return;
      }
      userInputMutate({inputId, responseData, orgSlug, runId});
    },
    [orgSlug, runId, userInputMutate]
  );

  const createPR = useCallback(
    (repoName?: string) => {
      if (!orgSlug || !runId) {
        return;
      }
      createPRMutate({orgSlug, runId, repoName});
    },
    [orgSlug, runId, createPRMutate]
  );

  // On partial response load - clear optimistic blocks once the server has persisted the user
  // message and produced a real assistant response after the insert point.
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
    }
  }, [apiData?.session?.blocks, apiData?.session?.updated_at, optimistic]);

  // On any completed state
  const isComplete = isSessionComplete(apiData?.session);
  useEffect(() => {
    if (isComplete) {
      setWaitingForInterrupt(false);
      setOptimistic(null);
    }
  }, [isComplete]);

  // Detect PR creation errors and show error messages
  useEffect(() => {
    const currentPRStates = apiData?.session?.repo_pr_states ?? {};
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
  }, [apiData?.session?.repo_pr_states]);

  // Filtered session data for UI, applying optimistic state
  const filteredSessionData = useMemo(() => {
    const rawSessionData = apiData?.session ?? null;
    const realBlocks = rawSessionData?.blocks || [];

    if (optimistic) {
      const insert = Math.min(Math.max(optimistic.insertIndex, 0), realBlocks.length);

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
        ...realBlocks.slice(0, insert),
        optimisticUserBlock,
        optimisticThinkingBlock,
      ];

      const baseSession = rawSessionData ?? {
        run_id: runId ?? undefined,
        blocks: [],
        status: 'processing' as const,
        updated_at: new Date().toISOString(),
      };

      return {
        ...baseSession,
        blocks: visibleBlocks,
        status: 'processing' as const,
      };
    }

    return rawSessionData;
  }, [apiData?.session, optimistic, runId]);

  return {
    sessionData: filteredSessionData,
    isPolling,
    isError,
    errorStatusCode,
    sendMessage,
    runId,
    /** Switches to a different run and fetches its latest state. */
    switchToRun,
    /** Resets the run id, blocks, and other state. The new session isn't actually created until the user sends a message. */
    startNewSession,
    interruptRun,
    waitingForInterrupt,
    respondToUserInput,
    createPR,
    overrideCtxEngEnable,
    setOverrideCtxEngEnable,
    overrideCodeModeEnable,
    setOverrideCodeModeEnable,
  };
};
