import {useCallback, useEffect, useRef, useState} from 'react';

import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import useTimeout from 'sentry/utils/useTimeout';
import {
  ReplaySummaryStatus,
  ReplaySummaryTemp,
  type SummaryResponse,
} from 'sentry/views/replays/detail/ai/utils';

const POLL_INTERVAL_MS = 500; // Time between polls if the fetch request succeeds.
const ERROR_POLL_INTERVAL_MS = 5000; // Time between polls if the fetch request failed.
const POLL_TIMEOUT_MS = 100 * 1000; // Task timeout in Seer (90s) + 10s buffer.

export interface UseReplaySummaryResult {
  /**
   * Whether there was an error with the initial query or summary generation,
   * or the summary data status is errored.
   */
  isError: boolean;
  /**
   * Whether the summary is still processing after the last start request. Does not account for timeouts.
   */
  isPending: boolean;
  /**
   * Whether the last start request is pending.
   * The summary could still be processing even if this is false.
   */
  isStartSummaryRequestPending: boolean;
  /**
   * Whether the summary processing timed out. Not the same as isError.
   */
  isTimedOut: boolean;
  /** Function to trigger a new summary generation request. */
  startSummaryRequest: () => void;
  /** The summary data response from the API. */
  summaryData: SummaryResponse | undefined;
}

const shouldPoll = (
  summaryData: SummaryResponse | undefined,
  startRequestFailed: boolean,
  didTimeout: boolean
) => {
  if (startRequestFailed || didTimeout) {
    return false;
  }

  if (!summaryData) {
    return true;
  }

  switch (summaryData.status) {
    case ReplaySummaryStatus.NOT_STARTED:
    case ReplaySummaryStatus.PROCESSING:
      return true;

    // Final states
    case ReplaySummaryStatus.COMPLETED:
    case ReplaySummaryStatus.ERROR:
    default:
      return false;
  }
};

function createAISummaryQueryKey(
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string
): ApiQueryKey {
  return [`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/`];
}

export function useReplaySummary(
  replay: ReplayReader,
  options?: UseApiQueryOptions<SummaryResponse>
): UseReplaySummaryResult {
  const organization = useOrganization();
  const replayRecord = replay.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const segmentCount = replayRecord?.count_segments ?? 0;
  const api = useApi();
  const queryClient = useQueryClient();
  // Use this to track when the start summary request was made to compare to when the last time
  // the summary data query was made. This hook will be considered in a pending state if the summary
  // data query was made before the start summary request.

  // Otherwise, when start request query is finished, in the same render loop, we 1) invalidate the
  // summary data query and 2) we have the stale version of the summary data. The consuming
  // component will briefly show a completed state before the summary data query updates.
  const startSummaryRequestTime = useRef<number>(0);
  const hasMadeStartRequest = useRef<boolean>(false);

  const [didTimeout, setDidTimeout] = useState(false);
  const {start: startPollingTimeout, cancel: cancelPollingTimeout} = useTimeout({
    timeMs: POLL_TIMEOUT_MS,
    onTimeout: () => {
      setDidTimeout(true);
    },
  });

  const {
    mutate: startSummaryRequestMutate,
    isError: isStartSummaryRequestError,
    isPending: isStartSummaryRequestPending,
  } = useMutation({
    mutationFn: () => {
      return api.requestPromise(
        `/projects/${organization.slug}/${project?.slug}/replays/${replayRecord?.id}/summarize/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            num_segments: segmentCount,
            temperature: ReplaySummaryTemp.MED,
          },
        }
      );
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

  const startSummaryRequest = useCallback(() => {
    if (options?.enabled === false) {
      return;
    }
    startSummaryRequestMutate();
    hasMadeStartRequest.current = true;

    // Start a new timeout.
    setDidTimeout(false);
    startPollingTimeout();
  }, [options?.enabled, startSummaryRequestMutate, startPollingTimeout]);

  const {
    data: summaryData,
    isPending,
    dataUpdatedAt,
  } = useApiQuery<SummaryResponse>(
    createAISummaryQueryKey(organization.slug, project?.slug, replayRecord?.id ?? ''),
    {
      staleTime: 0,
      retry: false,
      refetchInterval: query => {
        if (shouldPoll(query.state.data?.[0], isStartSummaryRequestError, didTimeout)) {
          return query.state.status === 'error'
            ? ERROR_POLL_INTERVAL_MS
            : POLL_INTERVAL_MS;
        }
        return false;
      },
      refetchOnWindowFocus: 'always',
      ...options,
    }
  );

  // Auto-start logic. Triggered at most once per page load.
  const segmentsIncreased =
    summaryData?.num_segments !== null &&
    summaryData?.num_segments !== undefined &&
    segmentCount > summaryData.num_segments;

  useEffect(() => {
    if (
      !hasMadeStartRequest.current &&
      (segmentsIncreased || summaryData?.status === ReplaySummaryStatus.NOT_STARTED)
    ) {
      startSummaryRequest();
    }
  }, [segmentsIncreased, startSummaryRequest, summaryData?.status]);

  const isPendingRet =
    dataUpdatedAt < startSummaryRequestTime.current ||
    isStartSummaryRequestPending ||
    isPending ||
    summaryData === undefined ||
    summaryData?.status === ReplaySummaryStatus.NOT_STARTED ||
    summaryData?.status === ReplaySummaryStatus.PROCESSING;

  // Clears the polling timeout when we get valid summary results.
  useEffect(() => {
    if (!isPendingRet) {
      cancelPollingTimeout();
    }
  }, [isPendingRet, cancelPollingTimeout]);

  return {
    summaryData,
    isPending: isPendingRet,
    isError:
      isStartSummaryRequestError || summaryData?.status === ReplaySummaryStatus.ERROR,
    isTimedOut: didTimeout,
    startSummaryRequest,
    isStartSummaryRequestPending,
  };
}
