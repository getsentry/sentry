import {useEffect, useState} from 'react';

import {getDateFromTimestampAssumeUtc} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';
import {
  isSeerExplorerEnabled,
  makeSeerExplorerQueryKey,
} from 'sentry/views/seerExplorer/utils';

const POLL_INTERVAL = 500; // Poll every 500ms
const STALE_TIME_MS = 120_000;

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
  runId: number | null,
  sessionData: SeerExplorerResponse['session'] | undefined,
  isError: boolean,
  override: boolean | undefined
): 'polling' | 'not-polling' | 'timed-out' => {
  if (override !== undefined) {
    return override ? 'polling' : 'not-polling';
  }
  if (runId === null) {
    return 'not-polling';
  }
  if (isError) {
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
 * Single source of truth for Seer session polling. Runs the shared `useApiQuery`
 * (deduped across observers by key) and derives `isPolling`. Called by both
 * `useSeerExplorer` (with mutation state) and `SeerExplorerContextProvider`
 * (without) so the session state is observable globally.
 *
 * @param runId - The run ID to poll.
 * @param shouldPollOverride - Useful for passing a state variable to always poll / not poll
 *  when some condition is true, e.g. a mutation is pending. Disables timeout detection.
 *
 * Callers can expect isPolling and isTimedOut to be disjoint - can never both be true.
 */
export const useSeerExplorerPolling = ({
  runId,
  shouldPollOverride,
}: {
  runId: number | null;
  shouldPollOverride?: boolean;
}) => {
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;

  const {
    data: apiData,
    isError,
    error,
  } = useApiQuery<SeerExplorerResponse>(makeSeerExplorerQueryKey(orgSlug || '', runId), {
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    enabled: !!runId && isSeerExplorerEnabled(organization),
    refetchInterval: query => {
      if (
        getPollingState(
          runId,
          query.state.data?.json?.session,
          query.state.status === 'error',
          shouldPollOverride
        ) === 'polling'
      ) {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  // Schedule a timeout to force a re-render at the moment `updated_at` crosses STALE_TIME_MS,
  // so the returned pollingState is consistent with `refetchInterval`.
  const [, forceRender] = useState(false);

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
    shouldPollOverride
  );

  return {
    apiData,
    isError,
    errorStatusCode: error?.status ?? null,
    isPolling: pollingState === 'polling',
    isTimedOut: pollingState === 'timed-out',
  };
};
