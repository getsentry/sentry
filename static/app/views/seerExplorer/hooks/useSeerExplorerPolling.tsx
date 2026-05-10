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
const STALE_TIME_MS = 90_000;

/** Checks if session is in a terminal state where the agent is done processing. */
const isResponseComplete = (sessionData: SeerExplorerResponse['session'] | undefined) =>
  sessionData &&
  sessionData.status !== 'processing' &&
  sessionData.blocks.every((block: Block) => !block.loading) &&
  Object.values(sessionData?.repo_pr_states ?? {}).every(
    state => state.pr_creation_status !== 'creating'
  );

/** Checks if a timestamp is older than SESSION_STALE_TIME_MS. */
const isTimestampStale = (updatedAt: string | undefined) => {
  const date = getDateFromTimestampAssumeUtc(updatedAt);
  if (!date) {
    return false;
  }
  return Date.now() - date.getTime() >= STALE_TIME_MS;
};

const getPollingState = (
  runId: number | null,
  sessionData: SeerExplorerResponse['session'] | undefined,
  isError: boolean,
  isStale: boolean,
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
  if (isStale) {
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
    enabled: !!runId && !!orgSlug && isSeerExplorerEnabled(organization),
    refetchInterval: query => {
      if (
        getPollingState(
          runId,
          query.state.data?.json?.session,
          query.state.status === 'error',
          isTimestampStale(query.state.data?.json?.session?.updated_at),
          shouldPollOverride
        ) === 'polling'
      ) {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  // Track a separate isStale state for return value.
  // This allows us to trigger rerenders, and timeout after updated_at stops changing.
  const [isStale, setIsStale] = useState(false);

  const {start: startStaleTimeout, cancel: cancelStaleTimeout} = useTimeout({
    timeMs: STALE_TIME_MS,
    onTimeout: () => {
      setIsStale(true);
    },
  });

  // Update isStale on any timestamp or runId change
  useEffect(() => {
    if (isTimestampStale(apiData?.session?.updated_at)) {
      // Already stale
      setIsStale(true);
    } else if (runId !== null && apiData?.session?.updated_at) {
      // Start a timeout to set isStale after STALE_TIME_MS
      setIsStale(false);
      startStaleTimeout(); // overwrites any existing timeout
    } else {
      // Empty state or no data
      setIsStale(false);
      cancelStaleTimeout();
    }
  }, [runId, apiData?.session?.updated_at, startStaleTimeout, cancelStaleTimeout]);

  const pollingState = getPollingState(
    runId,
    apiData?.session,
    isError,
    isStale,
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
