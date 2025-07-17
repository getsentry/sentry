import {Fragment, type ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import isEqual from 'lodash/isEqual';

import {Switch} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAnalyticsPageSource,
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
const MAX_LOGS_PER_SECOND = 100; // Rate limit for initial check

type DisableReason =
  | 'sort'
  | 'timeout'
  | 'rateLimitInitial'
  | 'rateLimitDuring'
  | 'error'
  | 'absoluteTime';

const SWITCH_DISABLE_REASONS: DisableReason[] = [
  'sort',
  'rateLimitInitial',
  'absoluteTime',
];

interface AutorefreshToggleProps {
  averageLogsPerSecond?: number | null;
  disabled?: boolean;
}

export function AutorefreshToggle({
  disabled: externallyDisabled,
  averageLogsPerSecond = 0,
}: AutorefreshToggleProps) {
  const organization = useOrganization();
  const analyticsPageSource = useLogsAnalyticsPageSource();
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
  const hasAbsoluteDates = selection.datetime.start && selection.datetime.end;
  const isDescendingTimeBasedSort = checkSortIsTimeBasedDescending(sortBys);
  const isRateLimitedInitially =
    averageLogsPerSecond !== null && averageLogsPerSecond > MAX_LOGS_PER_SECOND; // null indicates the data is not available yet (eg. loading)

  const enabled =
    isDescendingTimeBasedSort &&
    checked &&
    defined(statsPeriod) &&
    !hasAbsoluteDates &&
    !externallyDisabled &&
    !isRateLimitedInitially;

  // Disable auto-refresh if anything in the selection changes
  useEffect(() => {
    const selectionChanged = !isEqual(previousSelection, selection);
    if (selectionChanged) {
      setChecked(false);
    }
  }, [selection, previousSelection, setChecked]);

  // Disable auto-refresh if the group-by changes
  useEffect(() => {
    if (groupBy && groupBy !== previousGroupBy) {
      setChecked(false);
    }
  }, [groupBy, previousGroupBy, setChecked]);

  // Reset disableReason when sort bys change
  useEffect(() => {
    if (previousSortBysString && sortBysString !== previousSortBysString) {
      setDisableReason(isDescendingTimeBasedSort ? undefined : 'sort');
    }
  }, [sortBysString, previousSortBysString, isDescendingTimeBasedSort]);

  // Check for absolute time period
  useEffect(() => {
    if (hasAbsoluteDates && !statsPeriod) {
      setDisableReason('absoluteTime');
    } else if (disableReason === 'absoluteTime' && statsPeriod && !hasAbsoluteDates) {
      setDisableReason(undefined);
    }
  }, [hasAbsoluteDates, statsPeriod, disableReason]);

  // Check for initial rate limiting
  useEffect(() => {
    if (isRateLimitedInitially) {
      setDisableReason('rateLimitInitial');
    } else if (disableReason === 'rateLimitInitial' && !isRateLimitedInitially) {
      setDisableReason(undefined);
    }
  }, [isRateLimitedInitially, disableReason]);

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
    const hasTimedOut = timeSinceStart > ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS;

    if (hasTimedOut) {
      trackAnalytics('logs.auto_refresh.timeout', {
        organization,
        page_source: analyticsPageSource,
      });
    }

    return hasTimedOut;
  }, [organization, analyticsPageSource]);

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
      setDisableReason('rateLimitDuring');
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

      setTimeout(executeRefresh, 0); // This is a hack to ensure that the initial page param is set before the auto-refresh query is made.
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

  const getTooltipMessage = (): ReactNode => {
    if (externallyDisabled) {
      return t('Auto-refresh is not available in the aggregates view.');
    }
    switch (disableReason) {
      case 'rateLimitInitial':
        return tct(
          'Auto-refresh is disabled due to high data volume ([maxLogsPerSecond] logs per second). Try adding a filter to reduce the number of logs.',
          {
            maxLogsPerSecond: MAX_LOGS_PER_SECOND,
          }
        );
      case 'rateLimitDuring':
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
      case 'absoluteTime':
        return t(
          'Auto-refresh is only supported when using a relative time period, not absolute dates.'
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
              const newChecked = !checked;

              trackAnalytics('logs.auto_refresh.toggled', {
                enabled: newChecked,
                organization,
                page_source: analyticsPageSource,
              });

              if (!checked) {
                // When enabling auto-refresh, reset the disable reason
                setDisableReason(undefined);
              }
              setChecked(newChecked);
            }}
          />
        </Tooltip>
        {t('Auto-refresh')}
      </AutoRefreshLabel>
    </Fragment>
  );
}
