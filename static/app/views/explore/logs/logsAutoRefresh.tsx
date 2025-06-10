import {useCallback, useEffect, useRef, useState} from 'react';

import {Switch} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAutoRefresh,
  useLogsRefreshInterval,
  useLogsSortBys,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {AutoRefreshLabel} from 'sentry/views/explore/logs/styles';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  checkSortIsTimeBasedDescending,
  parseLinkHeaderFromLogsPage,
} from 'sentry/views/explore/logs/utils';

const MAX_AUTO_REFRESH_TIME_MS = 1000 * 60 * 5; // 5 minutes
const ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS = 1000 * 60 * 15; // 15 minutes absolute max
const MAX_LOGS_PER_WINDOW = 5000; // Max logs in rolling window
const RATE_LIMIT_WINDOW_MS = 10 * 1000; // 10 seconds rolling window
const MIN_PAGE_SIZE_TO_CONTINUE = 200; // Continue fetching if page has more than this many logs

type DisableReason = 'sort' | 'timeout' | 'rateLimit';

export function AutorefreshToggle() {
  const checked = useLogsAutoRefresh();
  const setChecked = useSetLogsAutoRefresh();
  const sortBys = useLogsSortBys();
  const refreshInterval = useLogsRefreshInterval();
  const {infiniteLogsQueryResult} = useLogsPageData();
  const {fetchPreviousPage} = infiniteLogsQueryResult;

  // State for disable reason
  const [disableReason, setDisableReason] = useState<DisableReason>('sort');

  // Refs for interval management
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalStartTime = useRef(Date.now());
  const lastMouseMoveTime = useRef(Date.now());
  const isPausedRef = useRef(false);
  const isRefreshRunningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const statsPeriod = usePageFilters().selection.datetime.period;
  const isDescendingTimeBasedSort = checkSortIsTimeBasedDescending(sortBys);
  const enabled = isDescendingTimeBasedSort && checked && defined(statsPeriod);

  // Track mouse movement to extend timeout
  useEffect(() => {
    const handleMouseMove = () => {
      lastMouseMoveTime.current = Date.now();
    };

    if (enabled) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }

    return () => {}; // No cleanup needed when disabled
  }, [enabled]);

  const shouldPauseForVisibility = useCallback((): boolean => {
    if (document.visibilityState === 'hidden') {
      isPausedRef.current = true;
      return true;
    }
    isPausedRef.current = false;
    return false;
  }, []);

  const shouldDisableForTimeout = useCallback((): boolean => {
    const timeSinceStart = Date.now() - intervalStartTime.current;
    const timeSinceMouseMove = Date.now() - lastMouseMoveTime.current;

    // Always respect absolute max timeout
    if (timeSinceStart > ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS) {
      return true;
    }

    // If we're past 5 minutes but user has moved mouse recently (within 5 minutes), keep going
    if (timeSinceStart > MAX_AUTO_REFRESH_TIME_MS) {
      return timeSinceMouseMove > MAX_AUTO_REFRESH_TIME_MS;
    }

    return false;
  }, []);

  const countLogsFromPage = useCallback((pageResult: any): number => {
    // Count logs by walking back from latest until we hit MAX_LOGS_PER_WINDOW
    if (!pageResult?.data?.pages?.length) {
      return 0;
    }

    const pages = pageResult.data.pages;
    let totalLogCount = 0;

    // First get total count across all pages
    for (const page of pages) {
      const pageData = page?.[0]?.data;
      if (pageData?.length) {
        totalLogCount += pageData.length;
      }
    }

    // If we have fewer logs than the max, return the total
    if (totalLogCount <= MAX_LOGS_PER_WINDOW) {
      return totalLogCount;
    }

    // We have more than MAX_LOGS_PER_WINDOW, so find the cutoff timestamp
    // Walk back from the latest logs to find the timestamp at MAX_LOGS_PER_WINDOW position
    let logsFromLatest = 0;
    let cutoffTimestamp: bigint | null = null;

    // Start from the latest page (end of array, since data is desc sorted)
    for (let pageIndex = pages.length - 1; pageIndex >= 0; pageIndex--) {
      const pageData = pages[pageIndex]?.[0]?.data;
      if (!pageData?.length) {
        continue;
      }

      // Check if adding this page would exceed our limit
      if (logsFromLatest + pageData.length >= MAX_LOGS_PER_WINDOW) {
        // Find the exact cutoff within this page
        const indexInPage = MAX_LOGS_PER_WINDOW - logsFromLatest - 1;
        const cutoffLog = pageData[indexInPage];
        cutoffTimestamp = BigInt(cutoffLog[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
        break;
      }

      logsFromLatest += pageData.length;
    }

    if (!cutoffTimestamp) {
      return totalLogCount; // Fallback
    }

    // Now count logs from cutoff timestamp forward within the rate limit window
    const now = Date.now();
    const windowCutoff = BigInt((now - RATE_LIMIT_WINDOW_MS) * 1_000_000);

    // Use the more recent of the two cutoffs
    const effectiveCutoff =
      cutoffTimestamp > windowCutoff ? cutoffTimestamp : windowCutoff;

    let logCount = 0;
    for (const page of pages) {
      const pageData = page?.[0]?.data;
      if (!pageData?.length) {
        continue;
      }

      for (const row of pageData) {
        const rowTimestamp = BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
        if (rowTimestamp >= effectiveCutoff) {
          logCount++;
        }
      }
    }

    return logCount;
  }, []);

  const shouldDisableForRateLimit = useCallback(
    (pageResult: any): boolean => {
      // Use the efficient .length approach to check rate limits on-demand
      const totalLogsInWindow = countLogsFromPage(pageResult);
      return totalLogsInWindow >= MAX_LOGS_PER_WINDOW;
    },
    [countLogsFromPage]
  );

  const fetchPagesWithRateLimit = useCallback(async (): Promise<void> => {
    let totalNewLogs = 0;
    let pageCount = 0;

    while (true) {
      if (shouldPauseForVisibility()) {
        return;
      }

      const previousPage = await fetchPreviousPage();

      if (!previousPage) {
        break;
      }

      // Check rate limit using the pageResult we just fetched
      if (shouldDisableForRateLimit(previousPage)) {
        setDisableReason('rateLimit');
        setChecked(false);
        return;
      }

      // Use a simpler count for this page only for the continuation logic
      const latestPageLogCount = previousPage?.data?.pages?.length
        ? previousPage.data.pages[previousPage.data.pages.length - 1]?.[0]?.data
            ?.length || 0
        : 0;

      totalNewLogs += latestPageLogCount;
      pageCount++;

      const parsed = parseLinkHeaderFromLogsPage(previousPage);

      // Stop if no more pages available
      if (!parsed.next?.results) {
        break;
      }

      // Stop if this page had few logs (we're caught up)
      if (latestPageLogCount <= MIN_PAGE_SIZE_TO_CONTINUE) {
        break;
      }
    }

    // Log when we have issues getting logs to help debug
    if (totalNewLogs === 0 && pageCount > 0) {
      // eslint-disable-next-line no-console
      console.log(
        '[AutoRefresh] Warning: Fetched pages but got 0 logs. This may indicate a data extraction issue.'
      );
    }
  }, [
    shouldPauseForVisibility,
    fetchPreviousPage,
    shouldDisableForRateLimit,
    setChecked,
  ]);

  // Set up the refresh interval
  useEffect(() => {
    if (enabled) {
      // Cancel any ongoing requests first
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Reset all state
      isPausedRef.current = false;
      isRefreshRunningRef.current = false;
      intervalStartTime.current = Date.now();
      setDisableReason('sort');

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Define the refresh function inside useEffect to avoid dependency issues
      const executeRefresh = async () => {
        // Prevent concurrent refreshes
        if (isRefreshRunningRef.current) {
          return;
        }

        isRefreshRunningRef.current = true;

        try {
          // Check timeout first
          if (shouldDisableForTimeout()) {
            setDisableReason('timeout');
            setChecked(false);
            return;
          }

          // Rate limiting is checked within fetchPagesWithRateLimit using actual page data
          await fetchPagesWithRateLimit();
        } finally {
          isRefreshRunningRef.current = false;
        }
      };

      // Start immediate refresh and set up interval
      executeRefresh();
      intervalRef.current = setInterval(executeRefresh, refreshInterval);
    } else {
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clean up interval when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Reset running state
      isRefreshRunningRef.current = false;
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isRefreshRunningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshInterval]);

  const getTooltipMessage = (): string => {
    if (!isDescendingTimeBasedSort) {
      return t(
        'Auto-refresh is only supported when sorting by time in descending order and using a relative time period.'
      );
    }

    if (disableReason === 'rateLimit') {
      return t(
        'Auto-refresh was disabled due to high data volume. Try adding a filter to reduce the number of logs.'
      );
    }

    return t(
      'Auto-refresh is only supported when sorting by time in descending order and using a relative time period.'
    );
  };

  return (
    <AutoRefreshLabel>
      <Tooltip
        title={getTooltipMessage()}
        disabled={isDescendingTimeBasedSort && disableReason !== 'rateLimit'}
        skipWrapper
      >
        <Switch
          disabled={!isDescendingTimeBasedSort || disableReason === 'rateLimit'}
          checked={checked}
          onChange={() => setChecked(!checked)}
        />
      </Tooltip>
      {t('Auto-refresh')}
    </AutoRefreshLabel>
  );
}
