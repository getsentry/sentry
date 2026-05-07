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
const STALE_TIME_MS = 2_000;

/** Checks if session is in a terminal state where the agent is done processing. */
const isResponseComplete = (sessionData: SeerExplorerResponse['session'] | undefined) =>
  sessionData &&
  sessionData.status !== 'processing' &&
  sessionData.blocks.every((block: Block) => !block.loading) &&
  Object.values(sessionData?.repo_pr_states ?? {}).every(
    state => state.pr_creation_status !== 'creating'
  );

/** Checks if session hasn't been updated in SESSION_STALE_TIME_MS. */
const isResponseStale = (sessionData: SeerExplorerResponse['session'] | undefined) => {
  const updatedAt = getDateFromTimestampAssumeUtc(sessionData?.updated_at);
  if (!updatedAt) {
    return false;
  }
  return Date.now() - updatedAt.getTime() >= STALE_TIME_MS;
};

const getPollingState = (
  runId: number | null,
  sessionData: SeerExplorerResponse['session'] | undefined,
  isError: boolean,
  isStale: boolean,
  override: boolean | undefined
) => {
  if (runId === null) {
    return 'not-polling';
  }
  if (override !== undefined) {
    return override ? 'polling' : 'not-polling';
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
      const isStale = isResponseStale(query.state.data?.json?.session);
      if (
        getPollingState(
          runId,
          query.state.data?.json?.session,
          query.state.status === 'error',
          isStale,
          shouldPollOverride
        ) === 'polling'
      ) {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  // For display, track a separate isStale state, since it depends on the current time and needs to trigger rerenders.
  const [isStale, setIsStale] = useState(false);

  const {start: startStaleTimeout, cancel: cancelStaleTimeout} = useTimeout({
    timeMs: STALE_TIME_MS,
    onTimeout: () => {
      setIsStale(true);
    },
  });

  // Reset stale timer each time updated_at changes
  useEffect(() => {
    setIsStale(false);
    if (apiData?.session?.updated_at) {
      startStaleTimeout();
    } else {
      cancelStaleTimeout();
    }
  }, [apiData?.session?.updated_at, startStaleTimeout, cancelStaleTimeout]);

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
