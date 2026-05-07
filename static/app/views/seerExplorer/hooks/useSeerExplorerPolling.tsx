import {useState} from 'react';

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
const STALE_TIME_MS = 90_000;

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

/**
 * Single source of truth for Seer session polling. Runs the shared `useApiQuery`
 * (deduped across observers by key) and derives `isPolling`. Called by both
 * `useSeerExplorer` (with mutation state) and `SeerExplorerContextProvider`
 * (without) so the session state is observable globally.
 *
 * @param runId - The run ID to poll.
 * @param shouldPollOverride - Always poll when this is true. Useful for passing in a state variable to always poll
 *  when some condition is true, e.g. a mutation is pending.
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

  // Derive isPolling and isTimedOut a state so they can trigger rerenders.
  const [pollingState, setPollingState] = useState<
    'polling' | 'timed-out' | 'not-polling'
  >('not-polling');

  const {
    data: apiData,
    isError,
    error,
  } = useApiQuery<SeerExplorerResponse>(makeSeerExplorerQueryKey(orgSlug || '', runId), {
    staleTime: 0,
    retry: false,
    enabled: !!runId && !!orgSlug && isSeerExplorerEnabled(organization),
    refetchInterval: query => {
      if (shouldPollOverride) {
        setPollingState('polling');
        return POLL_INTERVAL;
      }
      if (query.state.status === 'error') {
        setPollingState('not-polling');
        return false;
      }
      // Stop polling on timeout.
      if (isResponseTimedOut(query.state.data?.json?.session)) {
        setPollingState('timed-out');
        return false;
      }
      if (isResponseComplete(query.state.data?.json?.session)) {
        setPollingState('not-polling');
        return false;
      }
      setPollingState('polling');
      return POLL_INTERVAL;
    },
  });

  return {
    apiData,
    isError,
    errorStatusCode: error?.status ?? null,
    isPolling: shouldPollOverride || pollingState === 'polling',
    isTimedOut: !shouldPollOverride && pollingState === 'timed-out',
  };
};
