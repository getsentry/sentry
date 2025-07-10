import {useCallback, useState} from 'react';

import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  type UseApiQueryOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {Block} from 'sentry/views/seerExplorer/types';

export type SeerExplorerResponse = {
  session: {
    messages: Block[];
    run_id: string;
    status: 'processing' | 'completed' | 'error';
    updated_at: string;
  } | null;
};

export type SeerExplorerChatResponse = {
  message: Block;
  run_id: string;
};

const POLL_INTERVAL = 500; // Poll every 500ms

export const makeSeerExplorerQueryKey = (
  orgSlug: string,
  runId?: string
): ApiQueryKey => [
  `/organizations/${orgSlug}/seer/explorer-chat/${runId ? `${runId}/` : ''}`,
  {},
];

const makeInitialSeerExplorerData = (): SeerExplorerResponse => ({
  session: null,
});

const makeErrorSeerExplorerData = (errorMessage: string): SeerExplorerResponse => ({
  session: {
    run_id: '',
    messages: [
      {
        id: 'error',
        type: 'response',
        content: `Error: ${errorMessage}`,
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
    sessionData.messages.some(message => message.loading)
  );
};

export const useSeerExplorer = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;

  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState<boolean>(false);
  const [deletedFromIndex, setDeletedFromIndex] = useState<number | null>(null);
  const [optimisticMessageIds, setOptimisticMessageIds] = useState<Set<string>>(
    new Set()
  );

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
        deletedFromIndex ?? (apiData?.session?.messages.length || 0);
      const calculatedInsertIndex = insertIndex ?? effectiveMessageLength;

      // Generate timestamp in seconds to match backend format
      const timestamp = Date.now() / 1000;

      // Optimistically add user message to the UI
      if (currentRunId && apiData?.session) {
        const userMessage: Block = {
          id: `user-${timestamp}`,
          type: 'user-input',
          content: query,
          timestamp: new Date().toISOString(),
          loading: false,
        };

        const loadingMessage: Block = {
          id: `loading-${timestamp}`,
          type: 'response',
          content: 'Thinking...',
          timestamp: new Date().toISOString(),
          loading: true,
        };

        // Use the effective message list (considering deletions) for optimistic update
        const effectiveMessages = wasDeleted
          ? apiData.session.messages.slice(0, calculatedInsertIndex)
          : apiData.session.messages;

        const updatedSession = {
          ...apiData.session,
          messages: [...effectiveMessages, userMessage, loadingMessage],
          status: 'processing' as const,
        };

        // Track optimistic message IDs
        setOptimisticMessageIds(
          prev => new Set([...prev, userMessage.id, loadingMessage.id])
        );

        setApiQueryData<SeerExplorerResponse>(
          queryClient,
          makeSeerExplorerQueryKey(orgSlug, currentRunId),
          {session: updatedSession}
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

        // Clear deletedFromIndex since we just sent a message from that point
        if (deletedFromIndex !== null) {
          setDeletedFromIndex(null);
        }

        // Invalidate queries to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: makeSeerExplorerQueryKey(orgSlug, response.run_id),
        });
      } catch (e) {
        setWaitingForResponse(false);
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
  if (sessionData?.messages && deletedFromIndex !== null) {
    // Separate optimistic messages from real messages
    const optimisticMessages = sessionData.messages.filter(msg =>
      optimisticMessageIds.has(msg.id)
    );
    const realMessages = sessionData.messages.filter(
      msg => !optimisticMessageIds.has(msg.id)
    );

    // Filter out real messages from the deleted index onwards, but keep optimistic messages
    const filteredRealMessages = realMessages.slice(0, deletedFromIndex);

    sessionData = {
      ...sessionData,
      messages: [...filteredRealMessages, ...optimisticMessages],
    };
  }

  if (waitingForResponse && sessionData?.messages) {
    // Stop waiting once we see the response is no longer loading
    const hasLoadingMessage = sessionData.messages.some(message => message.loading);

    if (!hasLoadingMessage && sessionData.status !== 'processing') {
      setWaitingForResponse(false);
      // Clear deleted index once response is complete
      setDeletedFromIndex(null);
      // Clear optimistic message IDs since they should now be real messages
      setOptimisticMessageIds(new Set());
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
