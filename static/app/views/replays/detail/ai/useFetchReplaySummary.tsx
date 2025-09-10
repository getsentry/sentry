import {useCallback, useEffect, useRef, useState} from 'react';

import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {
  ReplaySummaryStatus,
  ReplaySummaryTemp,
  type SummaryResponse,
} from 'sentry/views/replays/detail/ai/utils';

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 30 * 1000;

export interface UseFetchReplaySummaryResult {
  /**
   * Whether there was an error with the initial query or summary generation,
   * or the summary data status is errored.
   */
  isError: boolean;
  /**
   * Whether the summary is still processing after the last start request.
   */
  isPending: boolean;
  /**
   * Whether the last start request is pending.
   * The summary could still be processing even if this is false.
   */
  isStartSummaryRequestPending: boolean;
  /** Function to trigger a new summary generation request. */
  startSummaryRequest: () => void;
  /** The summary data response from the API. */
  summaryData: SummaryResponse | undefined;
}

const shouldPoll = (
  summaryData: SummaryResponse | undefined,
  isStartSummaryRequestPending: boolean,
  didTimeout: boolean
) => {
  // If timeout occurred, stop polling regardless of status
  if (didTimeout) {
    return false;
  }

  if (!summaryData) {
    // No data yet - poll if we've started a request
    return isStartSummaryRequestPending;
  }

  switch (summaryData.status) {
    case ReplaySummaryStatus.NOT_STARTED:
      // Not started - poll if we've started a request
      return isStartSummaryRequestPending;

    case ReplaySummaryStatus.PROCESSING:
      // Currently processing - poll
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
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string
): ApiQueryKey {
  return [`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/`];
}

export function useFetchReplaySummary(
  replay: ReplayReader,
  options?: UseApiQueryOptions<SummaryResponse>
): UseFetchReplaySummaryResult {
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

  const pollingTimeoutRef = useRef<number | null>(null);
  const clearPollingTimeout = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };
  const [didTimeout, setDidTimeout] = useState(false);

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      clearPollingTimeout();
    };
  }, []);

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

    // Start new polling timeout.
    setDidTimeout(false);
    clearPollingTimeout();
    pollingTimeoutRef.current = window.setTimeout(() => {
      setDidTimeout(true);
      clearPollingTimeout();
    }, POLL_TIMEOUT_MS);
  }, [options?.enabled, startSummaryRequestMutate]);

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
        if (shouldPoll(query.state.data?.[0], isStartSummaryRequestPending, didTimeout)) {
          return POLL_INTERVAL_MS;
        }
        return false;
      },
      refetchOnWindowFocus: 'always',
      ...options,
    }
  );

  useEffect(() => {
    // Clear the polling timeout when we get new summary results.
    if (!isPending) {
      clearPollingTimeout();
    }
  }, [isPending]);

  const isPendingRet =
    dataUpdatedAt < startSummaryRequestTime.current ||
    isStartSummaryRequestPending ||
    isPending ||
    summaryData?.status === ReplaySummaryStatus.PROCESSING;
  const isErrorRet =
    isStartSummaryRequestError ||
    isError ||
    summaryData?.status === ReplaySummaryStatus.ERROR ||
    didTimeout;

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
    if ((segmentsIncreased || needsInitialGeneration) && !isPendingRet && !isErrorRet) {
      startSummaryRequest();
    }
  }, [
    segmentsIncreased,
    needsInitialGeneration,
    isPendingRet,
    startSummaryRequest,
    isErrorRet,
  ]);

  return {
    summaryData,
    isPending: isPendingRet,
    isError: isErrorRet,
    startSummaryRequest,
    isStartSummaryRequestPending,
  };
}
