import {useCallback} from 'react';

import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {
  ReplaySummaryStatus,
  type SummaryResponse,
} from 'sentry/views/replays/detail/ai/utils';

const POLL_INTERVAL = 500;

function createAISummaryQueryKey(
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string
): ApiQueryKey {
  return [`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/`];
}

export function useFetchReplaySummary(options?: UseApiQueryOptions<SummaryResponse>) {
  const organization = useOrganization();
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    mutate: triggerSummaryMutate,
    isError: triggerError,
    isPending: isTriggerPending,
  } = useMutation({
    mutationFn: () =>
      api.requestPromise(
        `/projects/${organization.slug}/${project?.slug}/replays/${replayRecord?.id}/summarize/`,
        {
          method: 'POST',
        }
      ),
    onSuccess: () => {
      // invalidate the query when a summary is triggered
      // so the cached data is marked as stale.
      queryClient.invalidateQueries({
        queryKey: createAISummaryQueryKey(
          organization.slug,
          project?.slug,
          replayRecord?.id ?? ''
        ),
      });
    },
  });

  const {
    data: summaryData,
    isPending,
    isError,
  } = useApiQuery<SummaryResponse>(
    createAISummaryQueryKey(organization.slug, project?.slug, replayRecord?.id ?? ''),
    {
      staleTime: 0,
      retry: false,
      refetchInterval: query => {
        if (isPolling(query.state.data?.[0] || undefined, isTriggerPending)) {
          return POLL_INTERVAL;
        }
        return false;
      },
      refetchOnWindowFocus: 'always',
      ...options,
    }
  );

  const triggerSummary = useCallback(() => {
    // Don't trigger if the feature is disabled
    if (options?.enabled === false) {
      return;
    }

    triggerSummaryMutate();
  }, [options?.enabled, triggerSummaryMutate]);

  return {
    summaryData,
    isPolling: isPolling(summaryData, isTriggerPending),
    isPending: isPending || summaryData?.status === ReplaySummaryStatus.PROCESSING,
    isError: isError || summaryData?.status === ReplaySummaryStatus.ERROR || triggerError,
    triggerSummary,
    isTriggerPending,
  };
}

const isPolling = (
  summaryData: SummaryResponse | undefined,
  isTriggerPending: boolean
) => {
  if (!summaryData) {
    // No data yet - poll if we've started a run
    return isTriggerPending;
  }

  switch (summaryData.status) {
    case ReplaySummaryStatus.NOT_STARTED:
      // Not started - poll if we've initiated a run
      return isTriggerPending;

    case ReplaySummaryStatus.PROCESSING:
      // Currently processing - always poll
      return true;

    case ReplaySummaryStatus.COMPLETED:
    case ReplaySummaryStatus.ERROR:
      // Final states - no need to poll
      return false;

    default:
      // Unknown status - don't poll
      return false;
  }
};
