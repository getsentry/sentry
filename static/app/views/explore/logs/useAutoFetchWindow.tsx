import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {
  LOGS_HIGH_FIDELITY_INITIAL_AUTO_FETCH_WINDOW_MS,
  LOGS_HIGH_FIDELITY_RESUMED_AUTO_FETCH_WINDOW_MS,
} from 'sentry/views/explore/logs/constants';
import type {LogsInfiniteQueryKey} from 'sentry/views/explore/logs/useLogsApiOptions';

interface AutoFetchWindowOptions {
  canAutoFetchNextPage: boolean;
  fetchNextPage: () => unknown;
  isFetchingNextPage: boolean;
  nextPageCursor: string | null | undefined;
  queryKey: LogsInfiniteQueryKey;
}

function getAutoFetchWindowDeadlineMs(
  resumeCount: number,
  windowStartMs: number | undefined
) {
  if (!windowStartMs) {
    return;
  }

  if (!resumeCount) {
    return windowStartMs + LOGS_HIGH_FIDELITY_INITIAL_AUTO_FETCH_WINDOW_MS;
  }

  return windowStartMs + LOGS_HIGH_FIDELITY_RESUMED_AUTO_FETCH_WINDOW_MS * resumeCount;
}

/**
 * Time-bounds the high-fidelity "needle in a haystack" auto-fetching.
 * Whenever the caller reports it wants to start (`canAutoFetchNextPage`),
 * this hook continuously calls `fetchNextPage` until the window closes.
 * `resumeAutoFetch` reopens progressively longer windows after the first.
 */
export function useAutoFetchWindow({
  queryKey,
  canAutoFetchNextPage,
  isFetchingNextPage,
  nextPageCursor,
  fetchNextPage,
}: AutoFetchWindowOptions) {
  const [windowStartMs, setWindowStartMs] = useState<number | undefined>();
  const [resumeCount, setResumeCount] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timesFetched = useRef(0);
  const deadlineMs = getAutoFetchWindowDeadlineMs(resumeCount, windowStartMs);

  const queryKeyHash = useMemo(() => {
    const {url, options} = parseQueryKey(queryKey);
    return JSON.stringify([url, options?.query]);
  }, [queryKey]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setWindowStartMs(undefined);
    setResumeCount(0);
    timesFetched.current = 0;
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [queryKeyHash]);

  useEffect(() => {
    if (!canAutoFetchNextPage || isFetchingNextPage) {
      return;
    }

    const currentNowMs = Date.now();
    // oxlint-disable-next-line react/set-state-in-effect
    setNowMs(currentNowMs);

    if (!windowStartMs) {
      setWindowStartMs(currentNowMs);
      return;
    }

    if (deadlineMs && currentNowMs >= deadlineMs) {
      Sentry.metrics.distribution(
        'explore.logs.flex_time_pages_before_data',
        timesFetched.current,
        {attributes: {status: 'out_of_time'}}
      );
      return;
    }

    Sentry.metrics.distribution(
      'explore.logs.flex_time_pages_before_data',
      timesFetched.current,
      {attributes: {status: 'fetching'}}
    );

    timesFetched.current += 1;
    fetchNextPage();
  }, [
    canAutoFetchNextPage,
    deadlineMs,
    fetchNextPage,
    isFetchingNextPage,
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    nextPageCursor,
    resumeCount,
    windowStartMs,
  ]);

  const resumeAutoFetch = useCallback(() => {
    setResumeCount(resumeCount + 1);
    setWindowStartMs(Date.now());
  }, [resumeCount]);

  const shouldAutoFetchNextPage =
    canAutoFetchNextPage && (!deadlineMs || nowMs < deadlineMs);

  return {shouldAutoFetchNextPage, resumeAutoFetch};
}
