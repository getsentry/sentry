import {useCallback, useState} from 'react';

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

const POLL_INTERVAL = 1000; // Poll every second

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

  const [currentRunId, setCurrentRunId] = useState<number | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState<boolean>(false);
  const [deletedFromIndex, setDeletedFromIndex] = useState<number | null>(null);
  const [optimisticMessageIds, setOptimisticMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingOptimisticBlocks, setPendingOptimisticBlocks] = useState<{
    blocks: Block[];
    insertIndex: number;
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

      setWaitingForResponse(true);

      // Calculate insert index first
      const wasDeleted = deletedFromIndex !== null;
      const effectiveMessageLength =
        deletedFromIndex ?? (apiData?.session?.blocks.length || 0);
      const calculatedInsertIndex = insertIndex ?? effectiveMessageLength;

      // Generate timestamp in seconds to match backend format
      const timestamp = Date.now() / 1000;

      // Optimistically add user message to the UI
      if (currentRunId && apiData?.session) {
        const userMessage: Block = {
          id: `user-${timestamp}`,
          message: {
            role: 'user',
            content: query,
          },
          timestamp: new Date().toISOString(),
          loading: false,
        };

        const loadingMessage: Block = {
          id: `loading-${timestamp}`,
          message: {
            role: 'assistant',
            content: 'Thinking...',
          },
          timestamp: new Date().toISOString(),
          loading: true,
        };

        // Use the effective message list (considering deletions) for optimistic update
        const effectiveMessages = wasDeleted
          ? apiData.session.blocks.slice(0, calculatedInsertIndex)
          : apiData.session.blocks;

        const updatedSession = {
          ...apiData.session,
          blocks: [...effectiveMessages, userMessage, loadingMessage],
          status: 'processing' as const,
        };

        // Track optimistic message IDs
        setOptimisticMessageIds(
          prev => new Set([...prev, userMessage.id, loadingMessage.id])
        );

        // Keep a local copy of optimistic blocks so they persist across polls
        setPendingOptimisticBlocks({
          blocks: [userMessage, loadingMessage],
          insertIndex: calculatedInsertIndex,
        });

        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug, currentRunId),
          {session: updatedSession}
        );
      } else {
        // Handle optimistic UI for the first message (no run yet or no session in cache)
        const userMessage: Block = {
          id: `user-${timestamp}`,
          message: {
            role: 'user',
            content: query,
          },
          timestamp: new Date().toISOString(),
          loading: false,
        };

        const loadingMessage: Block = {
          id: `loading-${timestamp}`,
          message: {
            role: 'assistant',
            content: 'Thinking...',
          },
          timestamp: new Date().toISOString(),
          loading: true,
        };

        setOptimisticMessageIds(
          prev => new Set([...prev, userMessage.id, loadingMessage.id])
        );

        setPendingOptimisticBlocks({
          blocks: [userMessage, loadingMessage],
          insertIndex: calculatedInsertIndex,
        });

        const newSession: NonNullable<SeerExplorerResponse['session']> = {
          run_id: undefined,
          blocks: [userMessage, loadingMessage],
          status: 'processing',
          updated_at: new Date().toISOString(),
        };

        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug),
          {session: newSession}
        );
      }

      try {
        const response = (await api.requestPromise(
          `/organizations/${orgSlug}/seer/explorer-chat/${currentRunId ? `${currentRunId}/` : ''}`,
          {
            method: 'POST',
            data: {
              query,
              insert_index: calculatedInsertIndex,
              message_timestamp: timestamp,
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
        setPendingOptimisticBlocks(null);
        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug, currentRunId || undefined),
          makeErrorSeerExplorerData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [queryClient, api, orgSlug, currentRunId, apiData, deletedFromIndex]
  );

  const startNewSession = useCallback(() => {
    setCurrentRunId(null);
    setWaitingForResponse(false);
    setDeletedFromIndex(null);
    setOptimisticMessageIds(new Set());
    setPendingOptimisticBlocks(null);
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

  // Always filter messages based on deletedFromIndex before any other processing
  let sessionData = apiData?.session ?? null;

  // If we are between queries (e.g., first message just set a new run id and
  // the new query hasn't returned yet), keep showing optimistic blocks by
  // constructing an ephemeral processing session.
  if (!sessionData && pendingOptimisticBlocks) {
    sessionData = {
      run_id: currentRunId ?? undefined,
      blocks: pendingOptimisticBlocks.blocks,
      status: 'processing',
      updated_at: new Date().toISOString(),
    };
  }
  if (sessionData?.blocks && deletedFromIndex !== null) {
    // Separate optimistic messages from real messages
    const optimisticMessages = sessionData.blocks.filter(msg =>
      optimisticMessageIds.has(msg.id)
    );
    const realMessages = sessionData.blocks.filter(
      msg => !optimisticMessageIds.has(msg.id)
    );

    // Filter out real messages from the deleted index onwards, but keep optimistic messages
    const filteredRealMessages = realMessages.slice(0, deletedFromIndex);

    sessionData = {
      ...sessionData,
      blocks: [...filteredRealMessages, ...optimisticMessages],
    };
  }

  // If we have pending optimistic blocks and the server has not completed processing,
  // ensure they remain visible even if the next poll hasn't included them yet.
  if (sessionData) {
    if (pendingOptimisticBlocks && sessionData.status === 'processing') {
      const existingIds = new Set(sessionData.blocks.map(b => b.id));
      const nonExistingOptimistic = pendingOptimisticBlocks.blocks.filter(
        b => !existingIds.has(b.id)
      );

      if (nonExistingOptimistic.length > 0) {
        const safeInsertIndex = Math.min(
          Math.max(pendingOptimisticBlocks.insertIndex, 0),
          sessionData.blocks.length
        );
        const mergedBlocks = [
          ...sessionData.blocks.slice(0, safeInsertIndex),
          ...nonExistingOptimistic,
          ...sessionData.blocks.slice(safeInsertIndex),
        ];
        sessionData = {
          ...sessionData,
          blocks: mergedBlocks,
          status: 'processing',
        };
      }
    }

    // If processing is done, clear any pending optimistic blocks
    if (pendingOptimisticBlocks && sessionData.status !== 'processing') {
      setPendingOptimisticBlocks(null);
    }
  }

  if (waitingForResponse && sessionData?.blocks) {
    // Stop waiting once we see the response is no longer loading
    const hasLoadingMessage = sessionData.blocks.some(block => block.loading);

    if (!hasLoadingMessage && sessionData.status !== 'processing') {
      setWaitingForResponse(false);
      // Clear deleted index once response is complete
      setDeletedFromIndex(null);
      // Clear optimistic message IDs since they should now be real messages
      setOptimisticMessageIds(new Set());
      // Clear any pending optimistic blocks
      setPendingOptimisticBlocks(null);
    }
  }

  return {
    sessionData,
    isPolling: isPolling(sessionData, waitingForResponse),
    isPending,
    sendMessage,
    startNewSession,
    runId: currentRunId,
    deleteFromIndex,
    deletedFromIndex,
  };
};
