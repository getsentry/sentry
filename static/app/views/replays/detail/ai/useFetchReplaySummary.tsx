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

interface UseFetchReplaySummaryResult {
  /**
   * Whether there was an error with the initial query or summary generation,
   * or the summary data status is errored.
   */
  isError: boolean;
  /**
   * Whether the initial query is pending, the summary is being processed,
   * or the summary data status is processing.
   */
  isPending: boolean;
  /**
   * Whether the hook is currently polling for updates.
   * Polling will stop when the summary is completed or errored.
   */
  isPolling: boolean;
  /**
   * Whether a summary generation request is currently pending.
   * If pending and the summary is not completed or errored,
   * then polling will continue.
   */
  isStartSummaryRequestPending: boolean;
  /** Function to trigger a new summary generation request. */
  startSummaryRequest: () => void;
  /** The summary data response from the API. */
  summaryData: SummaryResponse | undefined;
}

const POLL_INTERVAL_MS = 500;

function createAISummaryQueryKey(
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string
): ApiQueryKey {
  return [`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/`];
}

export function useFetchReplaySummary(
  options?: UseApiQueryOptions<SummaryResponse>
): UseFetchReplaySummaryResult {
  const organization = useOrganization();
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const api = useApi();
  const queryClient = useQueryClient();

  const segmentCount = replayRecord?.count_segments ?? 0;

  const {
    mutate: startSummaryRequestMutate,
    isError: isStartSummaryRequestError,
    isPending: isStartSummaryRequestPending,
  } = useMutation({
    mutationFn: () =>
      api.requestPromise(
        `/projects/${organization.slug}/${project?.slug}/replays/${replayRecord?.id}/summarize/`,
        {
          method: 'POST',
          data: {
            num_segments: segmentCount,
          },
        }
      ),
    onSuccess: () => {
      // invalidate the query when a summary task is requested
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
        if (isPolling(query.state.data?.[0], isStartSummaryRequestPending)) {
          return POLL_INTERVAL_MS;
        }
        return false;
      },
      refetchOnWindowFocus: 'always',
      ...options,
    }
  );

  const startSummaryRequest = useCallback(() => {
    // Don't trigger if the feature is disabled
    if (options?.enabled === false) {
      return;
    }

    startSummaryRequestMutate();
  }, [options?.enabled, startSummaryRequestMutate]);

  return {
    summaryData,
    isPolling: isPolling(summaryData, isStartSummaryRequestPending),
    isPending:
      isPending ||
      summaryData?.status === ReplaySummaryStatus.PROCESSING ||
      isStartSummaryRequestPending,
    isError:
      isError ||
      summaryData?.status === ReplaySummaryStatus.ERROR ||
      isStartSummaryRequestError,
    startSummaryRequest,
    isStartSummaryRequestPending,
  };
}

const isPolling = (
  summaryData: SummaryResponse | undefined,
  isStartSummaryRequestPending: boolean
) => {
  if (!summaryData) {
    return true;
  }

  switch (summaryData.status) {
    case ReplaySummaryStatus.NOT_STARTED:
      // Not started - poll if we've initiated a run
      return isStartSummaryRequestPending;

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
