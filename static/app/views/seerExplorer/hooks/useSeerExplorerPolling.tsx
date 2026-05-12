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

/** Checks if a timestamp is older than STALE_TIME_MS. */
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
 * Staleness is computed directly from `updated_at` at both the `refetchInterval`
 * callback and the render-side `getPollingState` call, so they can't disagree.
 * A single timer is scheduled to fire at the exact moment the timestamp would
 * cross STALE_TIME_MS — its only job is to force a re-render so the returned
 * `isPolling` / `isTimedOut` reflect the transition (React Query's structural
 * sharing can otherwise suppress re-renders when `updated_at` is unchanged).
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
    enabled: !!runId && isSeerExplorerEnabled(organization),
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

  // Forces a re-render at the moment `updated_at` would cross STALE_TIME_MS,
  // so the returned `isPolling` / `isTimedOut` track the callback's check.
  const [, forceRender] = useState(0);

  const {start: startStaleTimeout, cancel: cancelStaleTimeout} = useTimeout({
    timeMs: STALE_TIME_MS,
    onTimeout: () => forceRender(t => t + 1),
  });

  useEffect(() => {
    const updatedAt = apiData?.session?.updated_at;
    if (!updatedAt || runId === null) {
      cancelStaleTimeout();
      return;
    }
    const date = getDateFromTimestampAssumeUtc(updatedAt);
    if (!date) {
      cancelStaleTimeout();
      return;
    }
    const remaining = STALE_TIME_MS - (Date.now() - date.getTime());
    if (remaining <= 0) {
      // Already stale — the render below will compute isTimedOut.
      cancelStaleTimeout();
      return;
    }
    startStaleTimeout(remaining);
  }, [runId, apiData?.session?.updated_at, startStaleTimeout, cancelStaleTimeout]);

  const pollingState = getPollingState(
    runId,
    apiData?.session,
    isError,
    isTimestampStale(apiData?.session?.updated_at),
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
