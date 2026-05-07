import {useEffect, useState} from 'react';

import {getDateFromTimestampAssumeUtc} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';
import {
  isSeerExplorerEnabled,
  makeSeerExplorerQueryKey,
} from 'sentry/views/seerExplorer/utils';

const POLL_INTERVAL = 500; // Poll every 500ms
const STALE_TIME_MS = 20_000;

/** Checks if session is in a terminal state where the agent is done processing. */
const isResponseComplete = (sessionData: SeerExplorerResponse['session'] | undefined) =>
  sessionData &&
  sessionData.status !== 'processing' &&
  sessionData.blocks.every((block: Block) => !block.loading) &&
  Object.values(sessionData?.repo_pr_states ?? {}).every(
    state => state.pr_creation_status !== 'creating'
  );

/** Checks if session is not complete and hasn't been updated in SESSION_STALE_TIME_MS. */
const isResponseTimedOut = (sessionData: SeerExplorerResponse['session'] | undefined) => {
  const updatedAt = getDateFromTimestampAssumeUtc(sessionData?.updated_at);
  if (!updatedAt) {
    return false;
  }
  return (
    !isResponseComplete(sessionData) && Date.now() - updatedAt.getTime() >= STALE_TIME_MS
  );
};

const isPolling = (
  sessionData: SeerExplorerResponse['session'] | undefined,
  isError: boolean,
  isTimedOut: boolean,
  override: boolean | undefined
) => {
  if (override !== undefined) {
    return override;
  }
  if (isError || isTimedOut) {
    return false;
  }
  return !isResponseComplete(sessionData);
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
  shouldPollOverride = false,
}: {
  runId: number | null;
  shouldPollOverride?: boolean;
}) => {
  const organization = useOrganization({allowNull: true});
  const orgSlug = organization?.slug;

  // Track an isTimedOut state so it can trigger rerenders.
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    setIsTimedOut(false);
  }, [runId, orgSlug]);

  const {
    data: apiData,
    isError,
    error,
  } = useApiQuery<SeerExplorerResponse>(makeSeerExplorerQueryKey(orgSlug || '', runId), {
    staleTime: 0,
    retry: false,
    enabled: !!runId && !!orgSlug && isSeerExplorerEnabled(organization),
    refetchInterval: query => {
      const newIsTimedOut = isResponseTimedOut(query.state.data?.json?.session);
      if (shouldPollOverride !== undefined) {
        // Updates timeout state on every successful fetch.
        setIsTimedOut(newIsTimedOut);
      }

      if (
        isPolling(
          query.state.data?.json?.session,
          query.state.status === 'error',
          newIsTimedOut,
          shouldPollOverride
        )
      ) {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  return {
    apiData,
    isError,
    errorStatusCode: error?.status ?? null,
    isPolling: isPolling(apiData?.session, isError, isTimedOut, shouldPollOverride),
    isTimedOut: !shouldPollOverride && isTimedOut,
  };
};
