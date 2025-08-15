import {useCallback, useEffect, useRef} from 'react';

import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import useReplayPrompt from 'sentry/views/replays/detail/ai/useReplayPrompt';
import {
  ReplaySummaryStatus,
  type SummaryResponse,
} from 'sentry/views/replays/detail/ai/utils';
import {asLogMessage} from 'sentry/views/replays/detail/ai/which';

export interface UseFetchReplaySummaryResult {
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

const isPolling = (
  summaryData: SummaryResponse | undefined,
  isStartSummaryRequestPending: boolean
) => {
  if (!summaryData) {
    // No data yet - poll if we've started a request
    return isStartSummaryRequestPending;
  }

  switch (summaryData.status) {
    case ReplaySummaryStatus.NOT_STARTED:
      // Not started - poll if we've started a request
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

function createAISummaryQueryKey(
  _orgSlug: string,
  _projectSlug: string | undefined,
  _replayId: string
): ApiQueryKey {
  return [`/v1/automation/summarize/replay/breadcrumbs/state`];
}

export function useFetchReplaySummary(
  replay: ReplayReader,
  options?: UseApiQueryOptions<SummaryResponse>
): UseFetchReplaySummaryResult {
  const organization = useOrganization();
  const replayRecord = replay.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const queryClient = useQueryClient();

  // Use this to track when the start summary request was made to compare to when the last time
  // the summary data query was made. This hook will be considered in a pending state if the summary
  // data query was made before the start summary request.

  // Otherwise, when start request query is finished, in the same render loop, we 1) invalidate the
  // summary data query and 2) we have the stale version of the summary data. The consuming
  // component will briefly show a completed state before the summary data query updates.
  const startSummaryRequestTime = useRef<number>(0);

  const segmentCount = replayRecord?.count_segments ?? 0;

  // Get the replay events and create logs
  const allEvents = [
    ...(replay?.getChapterFrames() ?? []), // includes all errors & feedback
    ...(replay?.getNetworkFrames() ?? []).filter(
      frame => !frame.op.startsWith('navigation')
    ),
    ...(replay?.getConsoleFrames() ?? []),
  ].sort((a, b) => a.timestampMs - b.timestampMs);

  const allData =
    allEvents
      .map(event => asLogMessage(event))
      .filter((item): item is string => item !== null && item !== '') ?? [];

  const logs = allData;
  const {data: promptData} = useReplayPrompt(replayRecord, logs);

  const {
    mutate: startSummaryRequestMutate,
    isError: isStartSummaryRequestError,
    isPending: isStartSummaryRequestPending,
  } = useMutation({
    mutationFn: async () => {
      if (!promptData) {
        throw new Error('No prompt data available');
      }

      // Call Seer using fetch
      const response = await fetch(`/v1/automation/summarize/replay/breadcrumbs/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Rpcsignature rpc0:${promptData.signature}`,
        },
        body: JSON.stringify(promptData.body ?? {}),
      });

      if (!response.ok) {
        throw new Error(`Failed to start summary task: ${response.status}`);
      }

      return response.json();
    },
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
      startSummaryRequestTime.current = Date.now();
    },
  });

  const {
    data: summaryData,
    isPending,
    isError,
    dataUpdatedAt,
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

  const isPollingRet = isPolling(summaryData, isStartSummaryRequestPending);
  const isPendingRet =
    dataUpdatedAt < startSummaryRequestTime.current ||
    isPending ||
    summaryData?.status === ReplaySummaryStatus.PROCESSING ||
    isStartSummaryRequestPending;
  const isErrorRet =
    isError ||
    summaryData?.status === ReplaySummaryStatus.ERROR ||
    isStartSummaryRequestError;

  // Auto-start logic.
  // TODO: remove the condition segmentCount <= 100
  // when BE is able to process more than 100 segments. Without this, generation will loop.
  const segmentsIncreased =
    summaryData?.num_segments !== null &&
    summaryData?.num_segments !== undefined &&
    segmentCount <= 100 &&
    segmentCount > summaryData.num_segments;
  const needsInitialGeneration = summaryData?.status === ReplaySummaryStatus.NOT_STARTED;

  useEffect(() => {
    if (
      (segmentsIncreased || needsInitialGeneration) &&
      !isPendingRet &&
      !isPollingRet &&
      !isErrorRet
    ) {
      startSummaryRequest();
    }
  }, [
    segmentsIncreased,
    needsInitialGeneration,
    isPendingRet,
    isPollingRet,
    startSummaryRequest,
    isErrorRet,
  ]);

  return {
    summaryData,
    isPolling: isPollingRet,
    isPending: isPendingRet,
    isError: isErrorRet,
    startSummaryRequest,
    isStartSummaryRequestPending,
  };
}
