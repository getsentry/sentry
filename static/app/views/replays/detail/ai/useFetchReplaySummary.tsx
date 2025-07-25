import {useCallback, useState} from 'react';

import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type RequestError from 'sentry/utils/requestError/requestError';
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
  return [
    `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/breadcrumbs-v2/`,
  ];
}

export function useFetchReplaySummary(options?: UseApiQueryOptions<SummaryResponse>) {
  const organization = useOrganization();
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const api = useApi();
  const queryClient = useQueryClient();

  const [waitingForNextRun, setWaitingForNextRun] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<boolean>(false);

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
        if (isPolling(query.state.data?.[0] || undefined, waitingForNextRun)) {
          return POLL_INTERVAL;
        }
        return false;
      },
      // refetchOnWindowFocus: 'always',
      ...options,
    } as UseApiQueryOptions<SummaryResponse, RequestError>
  );

  const triggerSummary = useCallback(async () => {
    setWaitingForNextRun(true);

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${project?.slug}/replays/${replayRecord?.id}/summarize/breadcrumbs-v2/`,
        {
          method: 'POST',
        }
      );
      queryClient.invalidateQueries({
        queryKey: createAISummaryQueryKey(
          organization.slug,
          project?.slug,
          replayRecord?.id ?? ''
        ),
      });
    } catch (e) {
      setWaitingForNextRun(false);
      setTriggerError(true);
    }
  }, [queryClient, api, organization.slug, project?.slug, replayRecord?.id]);

  return {
    summaryData,
    isPolling: isPolling(summaryData, waitingForNextRun),
    isPending: isPending || summaryData?.status === ReplaySummaryStatus.PROCESSING,
    isError: isError || summaryData?.status === ReplaySummaryStatus.ERROR || triggerError,
    triggerSummary,
  };
}

/** Will not poll when the replay summary is in an error state or has completed */
const isPolling = (summaryData: SummaryResponse | undefined, runStarted: boolean) => {
  if (!summaryData && !runStarted) {
    return false;
  }

  if (!summaryData?.data) {
    return true;
  }

  if (summaryData.status === ReplaySummaryStatus.PROCESSING) {
    return true;
  }

  return (
    !summaryData ||
    ![ReplaySummaryStatus.ERROR, ReplaySummaryStatus.COMPLETED].includes(
      summaryData.status
    )
  );
};
