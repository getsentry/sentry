import {useCallback, useEffect, useRef} from 'react';
import type {Location} from 'history';

import type {ApiResult} from 'sentry/api';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import type {InfiniteData} from 'sentry/utils/queryClient';
import {useQueryClient} from 'sentry/utils/queryClient';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {EventsLogsResult} from 'sentry/views/explore/logs/types';
import {useLogsQueryKeyWithInfinite} from 'sentry/views/explore/logs/useLogsQuery';

export const LOGS_AUTO_REFRESH_KEY = 'live';
export const LOGS_REFRESH_INTERVAL_KEY = 'refreshEvery';
export const LOGS_REFRESH_INTERVAL_DEFAULT = 5000;

export const ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS = 10 * 60 * 1000; // 10 minutes
export const CONSECUTIVE_PAGES_WITH_MORE_DATA = 3;

// These don't include the pre-flight conditions (wrong sort, absolute time, aggregates view, or initial rate limit) which are handled inside the toggle.
export type AutoRefreshState =
  | 'enabled'
  | 'timeout' // Hit 10 minute limit
  | 'rate_limit' // Too much data during refresh
  | 'error' // Fetch error
  | 'idle'; // Default (inactive ) state. Should never appear in query params.

interface LogsAutoRefreshContextValue {
  autoRefresh: AutoRefreshState;
  isTableFrozen: boolean | undefined;
  refreshInterval: number;
}

const [_LogsAutoRefreshProvider, _useLogsAutoRefresh, LogsAutoRefreshContext] =
  createDefinedContext<LogsAutoRefreshContextValue>({
    name: 'LogsAutoRefreshContext',
  });

interface LogsAutoRefreshProviderProps {
  children: React.ReactNode;
  _testContext?: Partial<LogsAutoRefreshContextValue>;
  isTableFrozen?: boolean;
}

export function LogsAutoRefreshProvider({
  children,
  isTableFrozen,
  _testContext,
}: LogsAutoRefreshProviderProps) {
  const location = useLocation();

  const autoRefreshRaw = decodeScalar(location.query[LOGS_AUTO_REFRESH_KEY]);
  const autoRefresh: AutoRefreshState = (
    autoRefreshRaw &&
    ['enabled', 'timeout', 'rate_limit', 'error'].includes(autoRefreshRaw)
      ? autoRefreshRaw
      : 'idle'
  ) as AutoRefreshState;

  const refreshInterval = decodeInteger(
    location.query[LOGS_REFRESH_INTERVAL_KEY],
    LOGS_REFRESH_INTERVAL_DEFAULT
  );

  return (
    <LogsAutoRefreshContext
      value={{
        autoRefresh,
        refreshInterval,
        isTableFrozen,
        ..._testContext,
      }}
    >
      {children}
    </LogsAutoRefreshContext>
  );
}

const useLogsAutoRefresh = _useLogsAutoRefresh;

export {useLogsAutoRefresh};

/**
 * Hook that returns a refetch interval callback for react query that handles auto-refresh interval.
 *
 * Also handles rate limiting, error checking, and timeout conditions.
 */
export function useLogsAutoRefreshRefetchIntervalCallback() {
  const {autoRefresh, refreshInterval} = useLogsAutoRefresh();
  const setAutoRefresh = useSetLogsAutoRefresh();
  const startTimeRef = useRef<number>(Date.now());
  const consecutivePagesWithMoreDataRef = useRef<number>(0);

  const refetchIntervalCallback = useCallback(
    (
      data: InfiniteData<ApiResult<EventsLogsResult>> | undefined,
      error: Error | null
    ): number | false | undefined => {
      // If auto-refresh is not enabled, don't refetch
      if (autoRefresh !== 'enabled') {
        return false;
      }

      // Check for timeout (10 minutes)
      const elapsedTime = Date.now() - startTimeRef.current;
      if (elapsedTime > ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS) {
        setAutoRefresh('timeout');
        return false;
      }

      // Check if there was an error in the query
      if (error) {
        setAutoRefresh('error');
        return false;
      }

      // Check for rate limiting based on consecutive pages with data
      // This checks if we have pages with next results indicating more data
      const lastPage = data?.pages?.[data.pages.length - 1];
      const linkHeader = lastPage?.[2]?.getResponseHeader?.('Link');

      if (linkHeader) {
        const parsed = parseLinkHeader(linkHeader);
        if (parsed?.next?.results) {
          consecutivePagesWithMoreDataRef.current++;

          if (
            consecutivePagesWithMoreDataRef.current > CONSECUTIVE_PAGES_WITH_MORE_DATA
          ) {
            setAutoRefresh('rate_limit');
            consecutivePagesWithMoreDataRef.current = 0;
            return false;
          }
        } else {
          consecutivePagesWithMoreDataRef.current = 0;
        }
      }

      return refreshInterval;
    },
    [autoRefresh, refreshInterval, setAutoRefresh]
  );

  // Reset start time when auto-refresh is enabled
  useEffect(() => {
    if (autoRefresh === 'enabled') {
      startTimeRef.current = Date.now();
      consecutivePagesWithMoreDataRef.current = 0;
    }
  }, [autoRefresh]);

  return refetchIntervalCallback;
}

/**
 * Returns whether autorefresh is currently enabled for logs.
 *
 * Note: This only checks if the autoRefresh state is 'enabled'. It does NOT check
 * pre-flight conditions (wrong sort, absolute time, aggregates view, or initial rate limit).
 * Those conditions are handled separately in the UI to prevent enabling autorefresh.
 *
 * For frozen tables (embedded views), this always returns false regardless of state.
 */
export function useLogsAutoRefreshEnabled() {
  const {autoRefresh, isTableFrozen} = useLogsAutoRefresh();
  return isTableFrozen ? false : autoRefresh === 'enabled';
}

export function useSetLogsAutoRefresh() {
  const location = useLocation();
  const navigate = useNavigate();
  const {queryKey} = useLogsQueryKeyWithInfinite({
    referrer: 'api.explore.logs-table',
    autoRefresh: false,
  });
  const queryClient = useQueryClient();

  return useCallback(
    (autoRefresh: AutoRefreshState) => {
      if (autoRefresh === 'enabled') {
        queryClient.removeQueries({queryKey});
        // Until we change our timeseries hooks to be build their query keys separately, we need to remove the query via the route.
        queryClient.removeQueries({queryKey: ['events-stats']});
      }

      const target: Location = {...location, query: {...location.query}};
      if (autoRefresh === 'idle') {
        delete target.query[LOGS_AUTO_REFRESH_KEY];
      } else {
        target.query[LOGS_AUTO_REFRESH_KEY] = autoRefresh;
      }
      navigate(target);
    },
    [navigate, location, queryClient, queryKey]
  );
}

export function useLogsRefreshInterval() {
  const {refreshInterval} = useLogsAutoRefresh();
  return refreshInterval;
}

export function useLogsAutoRefreshState() {
  const {autoRefresh} = useLogsAutoRefresh();
  return autoRefresh;
}
