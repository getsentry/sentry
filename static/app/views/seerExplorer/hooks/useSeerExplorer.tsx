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
  const sessionData = apiData?.session ?? null;

  const filteredSessionData = (() => {
    if (sessionData?.blocks && deletedFromIndex !== null) {
      return {
        ...sessionData,
        blocks: sessionData.blocks.slice(0, deletedFromIndex),
      } as NonNullable<typeof sessionData>;
    }
    return sessionData;
  })();

  if (waitingForResponse && filteredSessionData?.blocks) {
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
