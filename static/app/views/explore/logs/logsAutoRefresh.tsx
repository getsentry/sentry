import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import isEqual from 'lodash/isEqual';

import {Switch} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAutoRefresh,
  useLogsGroupBy,
  useLogsRefreshInterval,
  useLogsSortBys,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {AutoRefreshLabel} from 'sentry/views/explore/logs/styles';
import {
  checkSortIsTimeBasedDescending,
  parseLinkHeaderFromLogsPage,
} from 'sentry/views/explore/logs/utils';

const ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS = 1000 * 60 * 10; // 10 minutes absolute max
const CONSECUTIVE_PAGES_WITH_MORE_DATA = 3; // Number of consecutive requests with more data before disabling

type DisableReason = 'sort' | 'timeout' | 'rateLimit' | 'error';

const SWITCH_DISABLE_REASONS: DisableReason[] = ['sort'];

interface AutorefreshToggleProps {
  disabled?: boolean;
}

export function AutorefreshToggle({
  disabled: externallyDisabled,
}: AutorefreshToggleProps) {
  const checked = useLogsAutoRefresh();
  const setChecked = useSetLogsAutoRefresh();
  const sortBys = useLogsSortBys();
  const groupBy = useLogsGroupBy();
  const {selection} = usePageFilters();
  const previousSelection = usePrevious(selection);
  const previousGroupBy = usePrevious(groupBy);
  const refreshInterval = useLogsRefreshInterval();
  const {infiniteLogsQueryResult} = useLogsPageData();
  const {fetchPreviousPage, isError} = infiniteLogsQueryResult;

  const sortBysString = JSON.stringify(sortBys);
  const previousSortBysString = usePrevious(sortBysString);

  const [disableReason, setDisableReason] = useState<DisableReason | undefined>(
    undefined
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalStartTime = useRef(Date.now());
  const isPausedRef = useRef(false);
  const isRefreshRunningRef = useRef(false);
  const consecutivePagesWithMoreDataRef = useRef(0);

  const statsPeriod = selection.datetime.period;
  const isDescendingTimeBasedSort = checkSortIsTimeBasedDescending(sortBys);
  const enabled =
    isDescendingTimeBasedSort && checked && defined(statsPeriod) && !externallyDisabled;

  // Disable auto-refresh if anything in the selection changes
  useEffect(() => {
    const selectionChanged = !isEqual(previousSelection, selection);
    if (selectionChanged) {
      setChecked(false);
    }
  }, [selection, previousSelection, setChecked]);

  // Disable auto-refresh if the group-by changes
  useEffect(() => {
    if (isEqual(groupBy, previousGroupBy)) {
      setChecked(false);
    }
  }, [groupBy, previousGroupBy, setChecked]);

  // Reset disableReason when sort bys change
  useEffect(() => {
    if (previousSortBysString && sortBysString !== previousSortBysString) {
      setDisableReason(isDescendingTimeBasedSort ? undefined : 'sort');
    }
  }, [sortBysString, previousSortBysString, isDescendingTimeBasedSort]);

  // Disable auto-refresh when externally disabled
  useEffect(() => {
    if (externallyDisabled && checked) {
      setChecked(false);
    }
  }, [externallyDisabled, checked, setChecked]);

  useEffect(() => {
    if (isError && enabled) {
      setDisableReason('error');
      setChecked(false);
    }
  }, [isError, enabled, setChecked]);

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

    // Check if we've exceeded the absolute max timeout
    return timeSinceStart > ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS;
  }, []);

  // Our querying is currently at 5000 max logs per page, and our default refresh interval is 5 seconds.
  // This means each page if at it's max logs, we're getting 1000 logs per second.
  // We check if this is happening 3 times in a row, and if so, we disable auto-refresh since our rate limit is 1k/s and we're exceeding it.
  const shouldDisableForRateLimit = useCallback((pageResult: any): boolean => {
    const parsed = parseLinkHeaderFromLogsPage(pageResult);

    if (parsed.next?.results) {
      consecutivePagesWithMoreDataRef.current++;

      if (consecutivePagesWithMoreDataRef.current >= CONSECUTIVE_PAGES_WITH_MORE_DATA) {
        consecutivePagesWithMoreDataRef.current = 0;
        return true;
      }
    } else {
      consecutivePagesWithMoreDataRef.current = 0;
    }

    return false;
  }, []);

  const fetchPageWithRateLimitCheck = useCallback(async (): Promise<void> => {
    if (shouldPauseForVisibility()) {
      return;
    }

    let previousPage: any;
    try {
      previousPage = await fetchPreviousPage();
    } catch (error) {
      // Handle network errors or other exceptions
      setDisableReason('error');
      setChecked(false);
      return;
    }

    if (!previousPage) {
      // This can happen if the fetchPreviousPage call is stale (it returns promise.resolve())
      return;
    }

    // Check if the response indicates an error
    if (previousPage.status === 'error' || previousPage.isError) {
      setDisableReason('error');
      setChecked(false);
      return;
    }

    // Check rate limit using the pageResult we just fetched
    if (shouldDisableForRateLimit(previousPage)) {
      setDisableReason('rateLimit');
      setChecked(false);
      return;
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      isPausedRef.current = false;
      isRefreshRunningRef.current = false;
      intervalStartTime.current = Date.now();
      consecutivePagesWithMoreDataRef.current = 0;

      const executeRefresh = async () => {
        if (isRefreshRunningRef.current) {
          return;
        }

        isRefreshRunningRef.current = true;

        try {
          if (shouldDisableForTimeout()) {
            setDisableReason('timeout');
            setChecked(false);
            return;
          }

          await fetchPageWithRateLimitCheck();
        } finally {
          isRefreshRunningRef.current = false;
        }
      };

      executeRefresh();
      intervalRef.current = setInterval(executeRefresh, refreshInterval);
    } else {
      // Clean up interval when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Reset running state and counters
      isRefreshRunningRef.current = false;
      consecutivePagesWithMoreDataRef.current = 0;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isRefreshRunningRef.current = false;
      consecutivePagesWithMoreDataRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshInterval]);

  const getTooltipMessage = (): string => {
    if (externallyDisabled) {
      return t('Auto-refresh is not available in the aggregates view.');
    }
    switch (disableReason) {
      case 'rateLimit':
        return t(
          'Auto-refresh was disabled due to high data volume. Try adding a filter to reduce the number of logs.'
        );
      case 'timeout':
        return t(
          'Auto-refresh was disabled due to reaching the absolute max auto-refresh time of 10 minutes. Re-enable to continue.'
        );
      case 'error':
        return t(
          'Auto-refresh was disabled due to an error fetching logs. If the issue persists, please contact support.'
        );
      case 'sort':
      default:
        return t(
          'Auto-refresh is only supported when sorting by time in descending order and using a relative time period.'
        );
    }
  };

  return (
    <Fragment>
      <AutoRefreshLabel>
        <Tooltip
          title={getTooltipMessage()}
          disabled={disableReason === undefined && !externallyDisabled}
          skipWrapper
        >
          <Switch
            disabled={
              externallyDisabled ||
              (disableReason && SWITCH_DISABLE_REASONS.includes(disableReason))
            }
            checked={checked}
            onChange={() => {
              if (!checked) {
                // When enabling auto-refresh, reset the disable reason
                setDisableReason(undefined);
              }
              setChecked(!checked);
            }}
          />
        </Tooltip>
        {t('Auto-refresh')}
      </AutoRefreshLabel>
    </Fragment>
  );
}
