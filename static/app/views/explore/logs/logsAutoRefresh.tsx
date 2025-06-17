import {useEffect, useRef} from 'react';

import {Switch} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAutoRefresh,
  useLogsRefreshInterval,
  useLogsSortBys,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {AutoRefreshLabel} from 'sentry/views/explore/logs/styles';
import {checkSortIsTimeBased} from 'sentry/views/explore/logs/utils';

const MAX_AUTO_REFRESH_TIME_MS = 1000 * 60 * 5; // 5 minutes
const MAX_PAGES_PER_REFRESH = 10;
let _callCounts = 0;

export function AutorefreshToggle() {
  const checked = useLogsAutoRefresh();
  const setChecked = useSetLogsAutoRefresh();
  const sortBys = useLogsSortBys();
  const refreshInterval = useLogsRefreshInterval();
  const {infiniteLogsQueryResult} = useLogsPageData();
  const {fetchPreviousPage} = infiniteLogsQueryResult;

  const refreshCallback = useRef(() => {}); // Since the interval fetches data, it's an infinite dependency loop.

  const isTimeBasedSort = checkSortIsTimeBased(sortBys);
  const enabled = isTimeBasedSort && checked;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalStartTime = useRef(Date.now());
  const pauseRef = useRef(false);

  useEffect(() => {
    refreshCallback.current = async () => {
      const timeSinceIntervalStarted = Date.now() - intervalStartTime.current;
      if (timeSinceIntervalStarted > MAX_AUTO_REFRESH_TIME_MS) {
        setChecked(false);
        return;
      }

      if (document.visibilityState === 'hidden') {
        pauseRef.current = true;
      } else {
        pauseRef.current = false;
      }

      let page = 0;
      while (page < MAX_PAGES_PER_REFRESH) {
        if (pauseRef.current) {
          return;
        }
        const previousPage = await fetchPreviousPage();
        _callCounts++;
        if (!previousPage) {
          return;
        }
        const parsed = parseLinkHeader(
          previousPage.data?.pages?.[0]?.[2]?.getResponseHeader('Link') ?? null
        );
        // "Next" on the previous page is correct since the previous pages have reverse sort orders.
        if (parsed.next?.results) {
          page++;
        } else {
          return;
        }
      }
    };
    return () => {
      pauseRef.current = true;
    };
  }, [fetchPreviousPage, setChecked]);

  useEffect(() => {
    if (enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      pauseRef.current = false;

      refreshCallback.current();
      intervalRef.current = setInterval(refreshCallback.current, refreshInterval);
      intervalStartTime.current = Date.now();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, refreshInterval]);

  return (
    <AutoRefreshLabel>
      <Tooltip
        title={t('Auto-refresh is only supported when sorting by time.')}
        disabled={isTimeBasedSort}
        skipWrapper
      >
        <Switch
          disabled={!isTimeBasedSort}
          checked={checked}
          onChange={() => setChecked(!checked)}
        />
      </Tooltip>
      {t('Auto-refresh')}
    </AutoRefreshLabel>
  );
}
