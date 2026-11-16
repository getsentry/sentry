import {useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {
  AskSeerPollingResponse,
  AskSeerReferrer,
  AskSeerStartResponse,
  AskSeerStrategy,
  QueryTokensProps,
} from './types';

const POLL_INTERVAL = 500; // Poll every 500ms, matching Seer Explorer

/**
 * Generate the query key for polling the search agent state.
 */
const askSeerApiOptions = <T extends QueryTokensProps>(
  orgSlug: string,
  runId?: number | string
) =>
  apiOptions.as<AskSeerPollingResponse<T>>()(
    '/organizations/$organizationIdOrSlug/search-agent/state/$runId/',
    {path: {organizationIdOrSlug: orgSlug, runId: runId ?? ''}, staleTime: 0}
  );

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
  return sessionData.status === 'processing' || !!sessionData.current_step;
};

const makeInitialAskSeerData = <
  T extends QueryTokensProps,
>(): AskSeerPollingResponse<T> => ({
  session: null,
});

interface UseAskSeerPollingOptions {
  projectIds: number[];
  /**
   * Which surface started the run, used to pick the Seer referrer.
   */
  referrer: AskSeerReferrer;
  strategy: AskSeerStrategy;
  onError?: (error: Error) => void;
  options?: Record<string, unknown>;
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
  options: UseAskSeerPollingOptions
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const orgSlug = organization.slug;
  // Use devtoolbar to toggle frontend FF value and pass this as an override (toggle for internal testing)
  const codeModeToggle = organization.features.includes('seer-assisted-query-codemode');

  const [runId, setRunId] = useState<number | string | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [startError, setStartError] = useState<Error | null>(null);
  const inFlightQueryRef = useRef<string | null>(null);

  const queryOptions = askSeerApiOptions<T>(orgSlug, runId ?? undefined);
  const queryKey = runId ? queryOptions.queryKey : null;

  // Poll for state
  const {
    data: apiData,
    isPending,
    error: pollError,
  } = useQuery({
    ...queryOptions,
    staleTime: 0,
    retry: false,
    enabled: !!runId && !!orgSlug,
    refetchInterval: query => {
      if (query.state.status === 'error') {
        return false;
      }
      const sessionData = query.state.data?.json?.session ?? null;
      if (isPolling(sessionData, waitingForResponse)) {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  const sessionData = apiData?.session ?? null;

  // Start a new search
  const submitQuery = useCallback(
    async (query: string) => {
      if (inFlightQueryRef.current === query) {
        return;
      }
      inFlightQueryRef.current = query;
      setWaitingForResponse(true);
      setStartError(null);

      try {
        const response = (await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/search-agent/start/', {
            path: {organizationIdOrSlug: orgSlug},
          }),
          {
            method: 'POST',
            data: {
              natural_language_query: query,
              project_ids: options.projectIds,
              strategy: options.strategy,
              referrer: options.referrer,
              options: {
                ...options.options,
                code_mode: codeModeToggle,
              },
            },
          }
        )) as AskSeerStartResponse;

        const newRunId = response.sentry_run_id ?? response.run_id;
        if (!newRunId) {
          Sentry.captureMessage('Search agent start response missing run ID', 'error');
          // oxlint-disable-next-line react/todo
          throw new Error('Search agent start response missing run ID');
        }
        setRunId(newRunId);

        // Invalidate to start polling
        const newQueryKey = askSeerApiOptions<T>(orgSlug, newRunId).queryKey;
        if (newQueryKey) {
          queryClient.invalidateQueries({
            queryKey: newQueryKey,
          });
        }
      } catch (error) {
        const startErr = error instanceof Error ? error : new Error(String(error));
        inFlightQueryRef.current = null;
        setWaitingForResponse(false);
        setStartError(startErr);
        options.onError?.(startErr);
      }
    },
    [api, orgSlug, options, queryClient, codeModeToggle]
  );

  useEffect(() => {
    if (!waitingForResponse) {
      inFlightQueryRef.current = null;
    }
  }, [waitingForResponse]);

  // Handle completion callback
  useEffect(() => {
    if (!waitingForResponse) {
      return;
    }
    const isStillProcessing =
      sessionData?.status === 'processing' || !!sessionData?.current_step;
    if (pollError || (sessionData && !isStillProcessing)) {
      // oxlint-disable-next-line react/set-state-in-effect
      setWaitingForResponse(false);
    }
  }, [waitingForResponse, sessionData, pollError]);

  // Reset function
  const reset = useCallback(() => {
    inFlightQueryRef.current = null;
    setRunId(null);
    setWaitingForResponse(false);
    setStartError(null);
    if (queryKey) {
      queryClient.setQueryData(queryKey, previous => ({
        ...previous,
        headers: previous?.headers ?? {},
        json: makeInitialAskSeerData<T>(),
      }));
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
     * Whether polling is active.
     */
    isPolling: isPolling(sessionData, waitingForResponse),
    /**
     * Whether we're waiting for a response (initial load or polling).
     */
    isSessionPending: isActuallyPending,
    /**
     * Whether the agent run errored, or polling for its state failed.
     */
    isSessionError: sessionData?.status === 'error' || !!pollError,
    /**
     * Whether the start request failed (use fallback).
     */
    startFailed: startError !== null,
    /**
     * Request error from starting the run or polling its state, if any.
     */
    requestError: startError ?? pollError,
    /**
     * Whether the run finished successfully, even if it produced no queries.
     */
    isCompleted: sessionData?.status === 'completed',
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
