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
const isTimedOut = (sessionData: SeerExplorerResponse['session'] | undefined) => {
  const updatedAt = getDateFromTimestampAssumeUtc(sessionData?.updated_at);
  if (!updatedAt) {
    return false;
  }
  return (
    !isResponseComplete(sessionData) && Date.now() - updatedAt.getTime() >= STALE_TIME_MS
  );
};

/** Checks if we should poll for state updates. */
const isPolling = (
  runId: number | null,
  sessionData: SeerExplorerResponse['session'] | undefined,
  isMutatePending: boolean,
  isError: boolean
) => {
  if (isError) {
    return false;
  }
  if (isMutatePending) {
    return true;
  }
  if (!runId) {
    return false;
  }
  // Stop polling on timeout.
  if (isTimedOut(sessionData)) {
    return false;
  }
  return !isResponseComplete(sessionData);
};

/**
 * Single source of truth for Seer session polling. Runs the shared `useApiQuery`
 * (deduped across observers by key) and derives `isPolling`. Called by both
 * `useSeerExplorer` (with mutation state) and `SeerExplorerContextProvider`
 * (without) so the session state is observable globally.
 */
export const useSeerExplorerPolling = ({
  runId,
  isMutatePending = false,
}: {
  runId: number | null;
  isMutatePending?: boolean;
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
        isPolling(
          runId,
          query.state.data?.json?.session,
          isMutatePending,
          query.state.status === 'error'
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
    isPolling: isPolling(runId, apiData?.session, isMutatePending, isError),
    isTimedOut: isTimedOut(apiData?.session),
  };
};
