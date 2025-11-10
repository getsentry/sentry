import {useCallback, useRef, useState} from 'react';
import type {Location} from 'history';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {useQueryClient} from 'sentry/utils/queryClient';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  useLogsQueryHighFidelity,
  useLogsQueryKeyWithInfinite,
} from 'sentry/views/explore/logs/useLogsQuery';

export const LOGS_AUTO_REFRESH_KEY = 'live';
export const LOGS_REFRESH_INTERVAL_KEY = 'refreshEvery';
const LOGS_REFRESH_INTERVAL_DEFAULT = 5000;
const MAX_AUTO_REFRESH_PAUSED_TIME_MS = 60 * 1000; // 10 seconds

export const ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS = 10 * 60 * 1000; // 10 minutes
export const CONSECUTIVE_PAGES_WITH_MORE_DATA = 5;

// These don't include the pre-flight conditions (wrong sort, absolute time, aggregates view, or initial rate limit) which are handled inside the toggle.
export type AutoRefreshState =
  | 'enabled'
  | 'timeout' // Hit 10 minute limit
  | 'rate_limit' // Too much data during refresh
  | 'error' // Fetch error
  | 'paused' // Paused for MAX_AUTO_REFRESH_PAUSED_TIME_MS otherwise treated as idle
  | 'idle'; // Default (inactive ) state. Should never appear in query params.

interface LogsAutoRefreshContextValue {
  autoRefresh: AutoRefreshState;
  hasInitialized: boolean;
  isTableFrozen: boolean | undefined;
  pausedAt: number | undefined;
  refreshInterval: number;
  setPausedAt: (timestamp: number | undefined) => void;
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
  const [pausedAt, setPausedAt] = useState<number | undefined>(undefined);
  const hasInitialized = useRef(false);

  const allowedStates: AutoRefreshState[] = ['enabled', 'timeout', 'rate_limit', 'error'];
  if (hasInitialized.current) {
    // Paused is not allowed via linking since it requires internal state (pausedAt) to work.
    allowedStates.push('paused');
  }

  const rawState = decodeScalar(location.query[LOGS_AUTO_REFRESH_KEY]);
  const autoRefresh: AutoRefreshState =
    rawState && allowedStates.includes(rawState as AutoRefreshState)
      ? (rawState as AutoRefreshState)
      : 'idle';

  if (autoRefresh !== 'idle') {
    hasInitialized.current = true;
  }

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
        pausedAt,
        setPausedAt,
        hasInitialized: hasInitialized.current,
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

export function useLogsAutoRefreshContinued() {
  const {autoRefresh, pausedAt} = useLogsAutoRefresh();
  return autoRefresh === 'enabled' && pausedAtAllowedToContinue(pausedAt);
}

function withinPauseWindow(autoRefresh: AutoRefreshState, pausedAt: number | undefined) {
  return (
    (autoRefresh === 'paused' || autoRefresh === 'enabled') &&
    pausedAtAllowedToContinue(pausedAt)
  );
}

function pausedAtAllowedToContinue(pausedAt: number | undefined) {
  return pausedAt && Date.now() - pausedAt < MAX_AUTO_REFRESH_PAUSED_TIME_MS;
}

export function useSetLogsAutoRefresh() {
  const location = useLocation();
  const navigate = useNavigate();
  const highFidelity = useLogsQueryHighFidelity();
  const {queryKey} = useLogsQueryKeyWithInfinite({
    referrer: 'api.explore.logs-table',
    autoRefresh: true,
    highFidelity,
  });
  const queryClient = useQueryClient();
  const {setPausedAt, pausedAt: currentPausedAt} = useLogsAutoRefresh();

  return useCallback(
    (autoRefresh: AutoRefreshState) => {
      if (autoRefresh === 'enabled' && !withinPauseWindow(autoRefresh, currentPausedAt)) {
        queryClient.removeQueries({queryKey});
      }

      const newPausedAt = autoRefresh === 'paused' ? Date.now() : undefined;
      const target: Location = {...location, query: {...location.query}};
      if (autoRefresh === 'paused') {
        setPausedAt(newPausedAt);
      } else if (autoRefresh !== 'enabled') {
        // Any error state, or disabled state, should reset the pause state.
        setPausedAt(undefined);
      }

      if (autoRefresh === 'idle') {
        delete target.query[LOGS_AUTO_REFRESH_KEY];
      } else {
        target.query[LOGS_AUTO_REFRESH_KEY] = autoRefresh;
      }

      navigate(target);
    },
    [navigate, location, queryClient, queryKey, setPausedAt, currentPausedAt]
  );
}

export function useLogsRefreshInterval() {
  const {refreshInterval} = useLogsAutoRefresh();
  return refreshInterval;
}
