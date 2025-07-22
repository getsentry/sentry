import {useCallback} from 'react';
import type {Location} from 'history';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {useQueryClient} from 'sentry/utils/queryClient';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useLogsQueryKeyWithInfinite} from 'sentry/views/explore/logs/useLogsQuery';

export const LOGS_AUTO_REFRESH_KEY = 'live';
export const LOGS_REFRESH_INTERVAL_KEY = 'refreshEvery';
const LOGS_REFRESH_INTERVAL_DEFAULT = 5000;

export const ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS = 10 * 60 * 1000; // 10 minutes
export const CONSECUTIVE_PAGES_WITH_MORE_DATA = 5;

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

const [_LogsAutoRefreshProvider, useLogsAutoRefresh, LogsAutoRefreshContext] =
  createDefinedContext<LogsAutoRefreshContextValue>({
    name: 'LogsAutoRefreshContext',
  });

export {useLogsAutoRefresh};

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

/**
 * This only checks if the autoRefresh state is 'enabled'. It does NOT check
 * pre-flight conditions (wrong sort, absolute time, aggregates view, or initial rate limit).
 * Those conditions are handled separately in the UI to prevent enabling autorefresh.
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
