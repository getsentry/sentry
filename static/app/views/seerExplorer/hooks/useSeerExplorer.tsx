import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getDateFromTimestampAssumeUtc} from 'sentry/utils/dates';
import {fetchMutation, setApiQueryData} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {useAsciiSnapshot} from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
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
  '/issues/errors-outages/',
  '/issues/breached-metrics/',
  '/issues/warnings/',
  '/issues/:groupId/',
  '/issues/:groupId/events/',
  '/issues/:groupId/events/:eventId/',
]);
/** New experimental routes where the LLMContext tree provides structured page context. */
const NEW_STRUCTURED_CONTEXT_ROUTES = new Set<string>();

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

const getOptimisticAssistantTexts = () => [
  t('Looking around...'),
  t('One sec...'),
  t('Following breadcrumbs...'),
  t('Onboarding...'),
  t('Hold tight...'),
  t('Gathering threads...'),
  t('Tracing the answer...'),
  t('Stacking ideas...'),
  t('Profiling your project...'),
  t('Span by span...'),
  t('Rolling logs...'),
  t('Replaying prod...'),
  t('Scanning the error-waves...'),
];

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
  const {getPageReferrer} = usePageReferrer();
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
  const [lastSentMessage, setLastSentMessage] = useState<{
    insertIndex: number;
    loadingPlaceholderContent: string;
    query: string;
    timestampMs: number;
  } | null>(null);
  const [hasSentInterrupt, setHasSentInterrupt] = useState(false);
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
      setHasSentInterrupt(false);
      const queryKey = makeSeerExplorerQueryKey(params.orgSlug, params.runId);

      // Optimistic processing status to prevent isPolling flicker.
      if (params.runId !== null) {
        setApiQueryData<SeerExplorerResponse>(queryClient, queryKey, prev =>
          prev?.session
            ? {...prev, session: {...prev.session, status: 'processing'}}
            : prev
        );
      }
      const {url} = parseQueryKey(queryKey);
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
      if (params.runId === null) {
        // set run ID if this is a new session
        setRunId(response.run_id);
      } else {
        // invalidate the query so fresh data is fetched
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(params.orgSlug, params.runId),
        });
      }
    },
    onError: (e, params) => {
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
      setHasSentInterrupt(false);

      // Optimistic processing status to prevent isPolling flicker.
      if (params.runId !== null) {
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(params.orgSlug, params.runId),
          prev =>
            prev?.session
              ? {...prev, session: {...prev.session, status: 'processing'}}
              : prev
        );
      }
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
        queryKey: makeSeerExplorerQueryKey(params.orgSlug, params.runId),
      });
    },
    onError: (e, params) => {
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
      setHasSentInterrupt(false);

      // Optimistic processing status to prevent isPolling flicker.
      if (params.runId !== null) {
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(params.orgSlug, params.runId),
          prev =>
            prev?.session
              ? {...prev, session: {...prev.session, status: 'processing'}}
              : prev
        );
      }
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
        queryKey: makeSeerExplorerQueryKey(params.orgSlug, params.runId),
      });
    },
    onError: (e, params) => {
      addErrorMessage(
        typeof e.responseJSON?.detail === 'string'
          ? e.responseJSON.detail
          : 'Failed to create PR'
      );
      // Clear optimistic processing status
      queryClient.invalidateQueries({
        queryKey: makeSeerExplorerQueryKey(params.orgSlug, params.runId),
      });
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
      setHasSentInterrupt(true);
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

      // Set the new run ID and clear previous request states
      setRunId(newRunId);
      setLastSentMessage(null);
      setHasSentInterrupt(false);

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
    (query: string, explicitInsertIndex?: number, explicitRunId?: number | null) => {
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

      // Calculate new insert index
      const blocksLength = apiData?.session?.blocks.length || 0;
      const newInsertIndex = Math.min(
        Math.max(explicitInsertIndex ?? blocksLength, 0),
        blocksLength
      );

      // Pick a random placeholder for the next loading block, so it's deterministic per user message
      const texts = getOptimisticAssistantTexts();
      const placeholderContent = texts[Math.floor(Math.random() * texts.length)]!;

      // Update lastSentMessage for optimistic UI
      setLastSentMessage({
        query,
        insertIndex: newInsertIndex,
        timestampMs: Date.now(),
        loadingPlaceholderContent: placeholderContent,
      });

      // Send POST request
      sendMessageMutate({
        query,
        insertIndex: newInsertIndex,
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
      setLastSentMessage,
    ]
  );

  const interruptRun = useCallback(() => {
    if (!orgSlug || !runId) {
      return;
    }
    interruptRunMutate({orgSlug, runId});
  }, [orgSlug, runId, interruptRunMutate]);

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

  const rawSessionData = apiData?.session ?? null;

  // Append optimistic blocks to session data while polling, enabling a more responsive UI with loading placeholders.
  const processedSessionData = useMemo(() => {
    if (lastSentMessage === null || !isPolling) {
      return rawSessionData;
    }

    const serverBlocks = rawSessionData?.blocks || [];

    const {
      insertIndex,
      query: userQuery,
      timestampMs: lastSentTimestampMs,
      loadingPlaceholderContent,
    } = lastSentMessage;

    // Hydrated state - don't apply optimistic blocks once the server has persisted
    // the last user query and at least one assistant response.
    const blockAtInsert = serverBlocks[insertIndex];
    const serverHasUserBlock =
      blockAtInsert?.message.role === 'user' &&
      blockAtInsert?.message.content === userQuery &&
      (getDateFromTimestampAssumeUtc(blockAtInsert?.timestamp)?.getTime() ?? 0) >=
        Math.floor(lastSentTimestampMs / 1000) * 1000;

    const serverHasResponse = serverBlocks
      .slice(insertIndex + 1)
      .some(b => b.message.role === 'assistant' || b.message.role === 'tool_use');

    if (serverHasUserBlock && serverHasResponse) {
      return rawSessionData;
    }

    // Apply optimistic blocks with insertIndex truncation
    const optimisticUserBlock: Block = {
      id: `user-${insertIndex}-optimistic`,
      message: {role: 'user', content: userQuery},
      timestamp: new Date().toISOString(),
      loading: false,
    };

    const optimisticThinkingBlock: Block = {
      id: `loading-${insertIndex + 1}-optimistic`,
      message: {role: 'assistant', content: loadingPlaceholderContent},
      timestamp: new Date().toISOString(),
      loading: true,
    };

    // insertIndex should be in-bounds but clamp it here just in case.
    const validInsertIndex = Math.min(Math.max(insertIndex, 0), serverBlocks.length);
    const visibleBlocks = [
      ...serverBlocks.slice(0, validInsertIndex),
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
    };
  }, [rawSessionData, runId, lastSentMessage, isPolling]);

  return {
    sessionData: processedSessionData,
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
    hasSentInterrupt,
    respondToUserInput,
    createPR,
    overrideCtxEngEnable,
    setOverrideCtxEngEnable,
    overrideCodeModeEnable,
    setOverrideCodeModeEnable,
  };
};
