import {useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

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

const POLL_INTERVAL_MS = 500;
const ERROR_POLL_INTERVAL_MS = 5000;
const START_TIMEOUT_MS = 15_000; // Max time to wait for processing to start after a start request.
const TOTAL_TIMEOUT_MS = 100_000; // Max time to wait for results after a start request. Task timeout in Seer (90s) + 10s buffer.

function logReplaySummaryTimeout({extra}: {extra: Record<string, string>}) {
  Sentry.logger.info('Replay summary poll timed out', extra);
}
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
  const {start: startTotalTimeout, cancel: cancelTotalTimeout} = useTimeout({
    timeMs: TOTAL_TIMEOUT_MS,
    onTimeout: () => {
      setDidTimeout(true);
      logReplaySummaryTimeout({
        extra: {
          reason: 'Total timeout',
          orgSlug: organization.slug,
          replayId: replayRecord?.id ?? '',
          segmentCount: segmentCount.toString(),
        },
      });
    },
  });

  const {start: startStartTimeout, cancel: cancelStartTimeout} = useTimeout({
    timeMs: START_TIMEOUT_MS,
    onTimeout: () => {
      setDidTimeout(true);
      cancelTotalTimeout();
      logReplaySummaryTimeout({
        extra: {
          reason: 'Start timeout',
          orgSlug: organization.slug,
          replayId: replayRecord?.id ?? '',
          segmentCount: segmentCount.toString(),
        },
      });
    },
  });

  // Start initial timeouts in case auto-start request is not made. startSummaryRequest will cancel and restart them.
  // Should only run on mount since the callbacks are stable.
  useEffect(() => {
    startStartTimeout();
    startTotalTimeout();

    return () => {
      cancelTotalTimeout();
      cancelStartTimeout();
    };
  }, [startStartTimeout, startTotalTimeout, cancelTotalTimeout, cancelStartTimeout]);

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

    // Start new timeouts.
    setDidTimeout(false);
    startTotalTimeout();
    startStartTimeout();
  }, [options?.enabled, startSummaryRequestMutate, startTotalTimeout, startStartTimeout]);

  const {data: summaryData, dataUpdatedAt: lastFetchTime} = useApiQuery<SummaryResponse>(
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

  const isErrorState =
    isStartSummaryRequestError || summaryData?.status === ReplaySummaryStatus.ERROR;

  const isFinishedState =
    isErrorState ||
    (lastFetchTime >= startSummaryRequestTime.current &&
      !isStartSummaryRequestPending &&
      summaryData?.status === ReplaySummaryStatus.COMPLETED);

  // Cancel timeouts when we get a finished state.
  useEffect(() => {
    if (isFinishedState) {
      cancelTotalTimeout();
      cancelStartTimeout();
    }
  }, [cancelTotalTimeout, cancelStartTimeout, isFinishedState]);

  // Cancel the start timeout when status passes NOT_STARTED.
  useEffect(() => {
    if (
      summaryData &&
      summaryData.status !== ReplaySummaryStatus.NOT_STARTED &&
      (!summaryData.created_at || // note created_at should exist for started statuses
        new Date(summaryData.created_at).getTime() >
          startSummaryRequestTime.current - TOTAL_TIMEOUT_MS)
    ) {
      // Date condition is loose because a previously started task may be in-progress.
      cancelStartTimeout();
    }
  }, [cancelStartTimeout, summaryData]);

  return {
    summaryData,
    isPending: !isFinishedState,
    isError: isErrorState,
    isTimedOut: didTimeout,
    startSummaryRequest,
  };
}
