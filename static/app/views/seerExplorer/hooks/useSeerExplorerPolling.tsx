import {useEffect, useRef, useState} from 'react';

import {getDateFromTimestampAssumeUtc} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import {useSeerExplorerStream} from 'sentry/views/seerExplorer/hooks/useSeerExplorerStream';
import type {PollingState} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import type {
  SeerExplorerResponse,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';
import type {Block} from 'sentry/views/seerExplorer/types';
import {
  isSeerExplorerEnabled,
  makeSeerExplorerQueryKey,
} from 'sentry/views/seerExplorer/utils';

const POLL_INTERVAL = 500; // Poll every 500ms
const ERROR_POLL_INTERVAL = 2500; // Poll every 2500ms on 5xx errors
const MAX_ERROR_POLL_COUNT = Math.ceil(60_000 / ERROR_POLL_INTERVAL);
const STALE_TIME_MS = 120_000;

/**
 * Poll interval while a Conduit stream is delivering this run's output.
 *
 * Not `false`. The stream already carries every update, so this is pure
 * redundancy -- but at 1/30th the request volume it costs almost nothing, and it
 * makes "the stream silently stopped delivering" impossible to experience as a
 * frozen UI. Worth revisiting once production metrics show the stream is
 * reliable; until then a 97% reduction that cannot strand a user beats a 100%
 * reduction that can.
 */
const STREAMING_SAFETY_NET_INTERVAL = 15_000;

/** Checks if session is in a terminal state where the agent is done processing. */
const isResponseComplete = (sessionData: SeerExplorerResponse['session'] | undefined) =>
  sessionData &&
  sessionData.status !== 'processing' &&
  sessionData.blocks.every((block: Block) => !block.loading) &&
  Object.values(sessionData?.repo_pr_states ?? {}).every(
    state => state.pr_creation_status !== 'creating'
  );

/** Get the age of an ISO timestamp relative to now, in milliseconds. */
const getTimestampAge = (updatedAt: string | undefined): number | null => {
  const date = getDateFromTimestampAssumeUtc(updatedAt);
  if (!date || isNaN(date.getTime())) {
    return null;
  }
  return Date.now() - date.getTime();
};

const getPollingState = (
  runId: SeerExplorerRunId | null,
  sessionData: SeerExplorerResponse['session'] | undefined,
  isError: boolean,
  errorStatusCode: number | undefined,
  errorPollCount: number
): PollingState => {
  if (runId === null) {
    return 'not-polling';
  }
  if (isError) {
    if (
      errorStatusCode !== undefined &&
      errorStatusCode >= 500 &&
      errorStatusCode < 600 &&
      errorPollCount < MAX_ERROR_POLL_COUNT
    ) {
      return 'polling-with-backoff';
    }
    return 'not-polling';
  }
  if (isResponseComplete(sessionData)) {
    return 'not-polling';
  }
  if ((getTimestampAge(sessionData?.updated_at) ?? 0) >= STALE_TIME_MS) {
    return 'timed-out';
  }
  return 'polling';
};

/**
 * Drives Seer session polling via `useApiQuery` with a dynamic refetch interval.
 * Called exclusively by `SeerExplorerChatStateProvider`, which dispatches the
 * derived polling state into context for all consumers.
 *
 * When the org has Conduit streaming enabled, this also opens the stream and
 * drops the poll to a slow safety net while it stays healthy. The polling state
 * machine below is untouched by that: it remains exactly what the stream falls
 * back to, so a Conduit outage degrades to the behaviour we ship today.
 */
export const useSeerExplorerPolling = ({runId}: {runId: SeerExplorerRunId | null}) => {
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;
  const errorPollCountRef = useRef(0);
  const [, forceRender] = useState(false);

  // Reset error poll count when runId changes
  const prevRunIdRef = useRef(runId);
  if (prevRunIdRef.current !== runId) {
    prevRunIdRef.current = runId;
    errorPollCountRef.current = 0;
  }

  const {isStreaming} = useSeerExplorerStream({
    runId,
    enabled:
      !!runId &&
      isSeerExplorerEnabled(organization) &&
      !!organization?.features.includes('seer-explorer-conduit'),
  });

  // Read inside refetchInterval, which React Query calls outside of render and
  // so does not re-run when this value changes.
  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const {
    data: apiData,
    isError,
    error,
  } = useApiQuery<SeerExplorerResponse>(makeSeerExplorerQueryKey(orgSlug || '', runId), {
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    enabled: !!runId && isSeerExplorerEnabled(organization),
    refetchIntervalInBackground: true,
    refetchInterval: query => {
      const state = getPollingState(
        runId,
        query.state.data?.json?.session,
        query.state.status === 'error',
        query.state.error?.status,
        errorPollCountRef.current
      );
      if (state === 'polling-with-backoff') {
        errorPollCountRef.current++;
        if (errorPollCountRef.current >= MAX_ERROR_POLL_COUNT) {
          forceRender(v => !v);
        }
        return ERROR_POLL_INTERVAL;
      }
      if (state === 'polling') {
        errorPollCountRef.current = 0;
        if (isStreamingRef.current) {
          // The stream is delivering; this is only here to catch a stall.
          return STREAMING_SAFETY_NET_INTERVAL;
        }
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  // Schedule a timeout to force a re-render at the moment `updated_at` crosses STALE_TIME_MS,
  // so the returned pollingState is consistent with `refetchInterval`.
  const {start: startStaleTimeout, cancel: cancelStaleTimeout} = useTimeout({
    timeMs: STALE_TIME_MS,
    onTimeout: () => forceRender(v => !v),
  });

  useEffect(() => {
    const updatedAtAge = getTimestampAge(apiData?.session?.updated_at);
    if (updatedAtAge === null || runId === null) {
      // Empty state or no fetches yet
      cancelStaleTimeout();
      return;
    }
    if (updatedAtAge >= STALE_TIME_MS) {
      // Already stale
      cancelStaleTimeout();
      return;
    }
    const remaining = STALE_TIME_MS - updatedAtAge;
    startStaleTimeout(remaining + 1);
  }, [runId, apiData?.session?.updated_at, startStaleTimeout, cancelStaleTimeout]);

  // Polling state for UI components
  const pollingState = getPollingState(
    runId,
    apiData?.session,
    isError,
    error?.status,
    errorPollCountRef.current
  );

  return {
    pollingState,
    apiData,
    isError,
    errorStatusCode: error?.status,
    isPolling: pollingState === 'polling' || pollingState === 'polling-with-backoff',
    isTimedOut: pollingState === 'timed-out',
  };
};
