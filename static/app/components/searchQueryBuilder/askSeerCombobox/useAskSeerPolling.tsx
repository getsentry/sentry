import {useCallback, useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {
  AskSeerPollingResponse,
  AskSeerStartResponse,
  QueryTokensProps,
} from './types';

const POLL_INTERVAL = 500; // Poll every 500ms, matching Seer Explorer

/**
 * Generate the query key for polling the search agent state.
 */
export const makeAskSeerQueryKey = (
  orgSlug: string,
  runId?: number
): ApiQueryKey | null => {
  if (!runId) {
    return null;
  }
  return [`/organizations/${orgSlug}/search-agent/state/${runId}/`, {}];
};

/**
 * Determine if we should be polling for updates.
 */
const isPolling = <T extends QueryTokensProps>(
  sessionData: AskSeerPollingResponse<T>['session'],
  waitingForResponse: boolean
): boolean => {
  if (!sessionData && !waitingForResponse) {
    return false;
  }

  if (!sessionData) {
    return waitingForResponse;
  }

  // Poll while status is processing or there's a current step in progress
  return sessionData.status === 'processing' || sessionData.current_step !== null;
};

const makeInitialAskSeerData = <
  T extends QueryTokensProps,
>(): AskSeerPollingResponse<T> => ({
  session: null,
});

interface UseAskSeerPollingOptions<T extends QueryTokensProps> {
  projectIds: number[];
  strategy: string;
  onError?: (error: Error) => void;
  onSuccess?: (result: T) => void;
}

/**
 * Hook for managing async search agent polling.
 *
 * This hook follows the same pattern as useSeerExplorer:
 * 1. POST to /search-agent/start/ to start the agent and get a run_id
 * 2. Poll /search-agent/state/{run_id}/ for status and results
 * 3. Stop polling when status is completed or error
 */
export function useAskSeerPolling<T extends QueryTokensProps>(
  options: UseAskSeerPollingOptions<T>
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const orgSlug = organization.slug;

  const [runId, setRunId] = useState<number | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const queryKey = makeAskSeerQueryKey(orgSlug, runId ?? undefined);

  // Poll for state
  const {data: apiData, isPending} = useApiQuery<AskSeerPollingResponse<T>>(
    queryKey ?? ['__disabled__', {}],
    {
      staleTime: 0,
      retry: false,
      enabled: !!runId && !!orgSlug,
      refetchInterval: query => {
        const sessionData = query.state.data?.[0]?.session ?? null;
        if (isPolling(sessionData, waitingForResponse)) {
          return POLL_INTERVAL;
        }
        return false;
      },
    } as UseApiQueryOptions<AskSeerPollingResponse<T>, RequestError>
  );

  const sessionData = apiData?.session ?? null;

  // Start a new search
  const submitQuery = useCallback(
    async (query: string) => {
      setWaitingForResponse(true);

      try {
        const response = (await api.requestPromise(
          `/organizations/${orgSlug}/search-agent/start/`,
          {
            method: 'POST',
            data: {
              natural_language_query: query,
              project_ids: options.projectIds,
              strategy: options.strategy,
            },
          }
        )) as AskSeerStartResponse;

        setRunId(response.run_id);

        // Invalidate to start polling
        const newQueryKey = makeAskSeerQueryKey(orgSlug, response.run_id);
        if (newQueryKey) {
          queryClient.invalidateQueries({
            queryKey: newQueryKey,
          });
        }
      } catch (error) {
        setWaitingForResponse(false);
        setStartFailed(true);
        addErrorMessage((error as Error)?.message ?? 'Failed to start AI search');
        options.onError?.(error as Error);
      }
    },
    [api, orgSlug, options, queryClient]
  );

  // Handle completion callback
  useEffect(() => {
    if (waitingForResponse && sessionData) {
      const isStillProcessing =
        sessionData.status === 'processing' || sessionData.current_step !== null;
      if (!isStillProcessing) {
        setWaitingForResponse(false);
        if (sessionData.status === 'completed' && sessionData.final_response) {
          options.onSuccess?.(sessionData.final_response);
        }
      }
    }
  }, [waitingForResponse, sessionData, options]);

  // Reset function
  const reset = useCallback(() => {
    setRunId(null);
    setWaitingForResponse(false);
    setStartFailed(false);
    if (queryKey) {
      setApiQueryData<AskSeerPollingResponse<T>>(
        queryClient,
        queryKey,
        makeInitialAskSeerData()
      );
    }
  }, [queryClient, queryKey]);

  // Only show pending state after user has submitted a query
  const isActuallyPending = waitingForResponse || (!!runId && isPending);

  return {
    /**
     * Current session state, or null if no run exists.
     */
    sessionData,
    /**
     * Whether we're waiting for a response (initial load or polling).
     */
    isPending: isActuallyPending,
    /**
     * Whether polling is active.
     */
    isPolling: isPolling(sessionData, waitingForResponse),
    /**
     * Whether the request errored.
     */
    isError: sessionData?.status === 'error',
    /**
     * Whether the start request failed (use fallback).
     */
    startFailed,
    /**
     * The final response (available when status is completed).
     */
    finalResponse: sessionData?.final_response ?? null,
    /**
     * The final query string (available when status is completed).
     */
    finalQuery: sessionData?.final_query ?? null,
    /**
     * Unsupported reason if the query couldn't be translated.
     */
    unsupportedReason: sessionData?.unsupported_reason,
    /**
     * Current step being processed (if any).
     */
    currentStep: sessionData?.current_step ?? null,
    /**
     * Completed steps.
     */
    completedSteps: sessionData?.completed_steps ?? [],
    /**
     * Submit a natural language query to start the search agent.
     */
    submitQuery,
    /**
     * Reset the state to start fresh.
     */
    reset,
    /**
     * Current run ID.
     */
    runId,
  };
}
