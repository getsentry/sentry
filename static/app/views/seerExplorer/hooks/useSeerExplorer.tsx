import {useCallback, useEffect, useState} from 'react';

import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useAsciiSnapshot from 'sentry/views/seerExplorer/hooks/useAsciiSnapshot';
import type {Block} from 'sentry/views/seerExplorer/types';

export type SeerExplorerResponse = {
  session: {
    blocks: Block[];
    status: 'processing' | 'completed' | 'error';
    updated_at: string;
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

const makeSeerExplorerQueryKey = (orgSlug: string, runId?: number): ApiQueryKey => [
  `/organizations/${orgSlug}/seer/explorer-chat/${runId ? `${runId}/` : ''}`,
  {},
];

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

  if (!sessionData) {
    return true;
  }

  // Poll if status is processing or if any message is loading
  return (
    sessionData.status === 'processing' ||
    sessionData.blocks.some(message => message.loading)
  );
};

export const useSeerExplorer = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;
  const captureAsciiSnapshot = useAsciiSnapshot();

  const [currentRunId, setCurrentRunId] = useState<number | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState<boolean>(false);
  const [deletedFromIndex, setDeletedFromIndex] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<{
    assistantBlockId: string;
    assistantContent: string;
    baselineSignature: string;
    insertIndex: number;
    userBlockId: string;
    userQuery: string;
  } | null>(null);

  const {data: apiData, isPending} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(orgSlug || '', currentRunId || undefined),
    {
      staleTime: 0,
      retry: false,
      enabled: !!currentRunId && !!orgSlug,
      refetchInterval: query => {
        if (isPolling(query.state.data?.[0]?.session || null, waitingForResponse)) {
          return POLL_INTERVAL;
        }
        return false;
      },
    } as UseApiQueryOptions<SeerExplorerResponse, RequestError>
  );

  const sendMessage = useCallback(
    async (query: string, insertIndex?: number) => {
      if (!orgSlug) {
        return;
      }

      // Capture a coarse ASCII screenshot of the user's screen for extra context
      const screenshot = captureAsciiSnapshot?.();

      setWaitingForResponse(true);

      // Calculate insert index first
      const effectiveMessageLength =
        deletedFromIndex ?? (apiData?.session?.blocks.length || 0);
      const calculatedInsertIndex = insertIndex ?? effectiveMessageLength;

      // Generate timestamp in seconds to match backend format
      const timestamp = Date.now() / 1000;

      // Record current real blocks signature to know when to clear optimistic UI
      const baselineSignature = JSON.stringify(
        (apiData?.session?.blocks || []).map(b => [
          b.id,
          b.message.role,
          b.message.content,
          !!b.loading,
        ])
      );

      // Set optimistic UI: show user's message and a thinking placeholder,
      // and hide all real blocks after the insert point. IDs mimic real pattern.
      const assistantContent =
        OPTIMISTIC_ASSISTANT_TEXTS[
          Math.floor(Math.random() * OPTIMISTIC_ASSISTANT_TEXTS.length)
        ];
      setOptimistic({
        insertIndex: calculatedInsertIndex,
        userQuery: query,
        baselineSignature,
        userBlockId: `user-${timestamp}`,
        assistantBlockId: `assistant-${timestamp}`,
        assistantContent: assistantContent || 'Thinking...',
      });

      try {
        const response = (await api.requestPromise(
          `/organizations/${orgSlug}/seer/explorer-chat/${currentRunId ? `${currentRunId}/` : ''}`,
          {
            method: 'POST',
            data: {
              query,
              insert_index: calculatedInsertIndex,
              message_timestamp: timestamp,
              on_page_context: screenshot,
            },
          }
        )) as SeerExplorerChatResponse;

        // Set run ID if this is a new session
        if (!currentRunId) {
          setCurrentRunId(response.run_id);
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
          makeSeerExplorerQueryKey(orgSlug, currentRunId || undefined),
          makeErrorSeerExplorerData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [
      queryClient,
      api,
      orgSlug,
      currentRunId,
      apiData,
      deletedFromIndex,
      captureAsciiSnapshot,
    ]
  );

  const startNewSession = useCallback(() => {
    setCurrentRunId(null);
    setWaitingForResponse(false);
    setDeletedFromIndex(null);
    setOptimistic(null);
    if (orgSlug) {
      setApiQueryData<SeerExplorerResponse>(
        queryClient,
        makeSeerExplorerQueryKey(orgSlug),
        makeInitialSeerExplorerData()
      );
    }
  }, [queryClient, orgSlug]);

  const deleteFromIndex = useCallback((index: number) => {
    setDeletedFromIndex(index);
  }, []);

  // Always filter messages based on optimistic state and deletedFromIndex before any other processing
  const sessionData = apiData?.session ?? null;

  const filteredSessionData = (() => {
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
        run_id: currentRunId ?? undefined,
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
  })();

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

  if (
    waitingForResponse &&
    filteredSessionData &&
    Array.isArray(filteredSessionData.blocks)
  ) {
    // Stop waiting once we see the response is no longer loading
    const hasLoadingMessage = filteredSessionData.blocks.some(block => block.loading);

    if (!hasLoadingMessage && filteredSessionData.status !== 'processing') {
      setWaitingForResponse(false);
      // Clear deleted index once response is complete
      setDeletedFromIndex(null);
    }
  }

  return {
    sessionData: filteredSessionData,
    isPolling: isPolling(filteredSessionData, waitingForResponse),
    isPending,
    sendMessage,
    startNewSession,
    runId: currentRunId,
    deleteFromIndex,
    deletedFromIndex,
  };
};
