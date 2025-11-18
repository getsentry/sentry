import {useCallback, useEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';

import type {ApiResult} from 'sentry/api';
import type {
  InfiniteData,
  InfiniteQueryObserverRefetchErrorResult,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS,
  CONSECUTIVE_PAGES_WITH_MORE_DATA,
  useLogsAutoRefresh,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import type {EventsLogsResult} from 'sentry/views/explore/logs/types';
import {parseLinkHeaderFromLogsPage} from 'sentry/views/explore/logs/utils';

/**
 * Hook that manages the auto-refresh interval using setInterval.
 * Handles rate limiting, error checking, and timeout conditions.
 */
export function useLogsAutoRefreshInterval({
  fetchPreviousPage,
  isError,
}: {
  fetchPreviousPage: () =>
    | false
    | Promise<
        InfiniteQueryObserverRefetchErrorResult<
          InfiniteData<ApiResult<EventsLogsResult>>,
          Error
        >
      >;
  isError: boolean;
}) {
  const {autoRefresh, refreshInterval} = useLogsAutoRefresh();
  const setAutoRefresh = useSetLogsAutoRefresh();
  const organization = useOrganization();
  const organizationRef = useRef(organization);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const consecutivePagesWithMoreDataRef = useRef<number>(0);
  const isRefreshRunningRef = useRef(false);

  const shouldPauseForVisibility = useCallback((): boolean => {
    return document.visibilityState === 'hidden';
  }, []);

  const shouldDisableForTimeout = useCallback((): boolean => {
    const elapsedTime = Date.now() - startTimeRef.current;
    return elapsedTime > ABSOLUTE_MAX_AUTO_REFRESH_TIME_MS;
  }, []);

  const shouldDisableForRateLimit = useCallback(
    (
      pageResult: InfiniteQueryObserverRefetchErrorResult<
        InfiniteData<ApiResult<EventsLogsResult>>,
        Error
      >
    ): boolean => {
      const parsed = parseLinkHeaderFromLogsPage(pageResult);
      if (!parsed?.next?.results) {
        consecutivePagesWithMoreDataRef.current = 0;
        return false;
      }

      consecutivePagesWithMoreDataRef.current++;

      if (consecutivePagesWithMoreDataRef.current >= CONSECUTIVE_PAGES_WITH_MORE_DATA) {
        consecutivePagesWithMoreDataRef.current = 0;
        return true;
      }

      return false;
    },
    []
  );

  const fetchPageWithChecks = useCallback(async () => {
    if (shouldPauseForVisibility() || isRefreshRunningRef.current) {
      return;
    }

    isRefreshRunningRef.current = true;

    try {
      if (shouldDisableForTimeout()) {
        setAutoRefresh('timeout');
        return;
      }

      if (isError) {
        Sentry.logger.info('Auto-refresh error due to isError', {
          error: isError,
          status: 'error',
          isError: true,
          organization: organizationRef.current.slug,
        });
        setAutoRefresh('error');
        return;
      }

      const previousPage = await fetchPreviousPage();

      if (!previousPage) {
        // This can happen if the fetchPreviousPage call is stale
        return;
      }

      const pageResult = previousPage;
      if (pageResult.status === 'error' || pageResult.isError) {
        Sentry.logger.info('Error fetching previous page', {
          error: pageResult.error,
          status: pageResult.status,
          isError: pageResult.isError,
          organization: organizationRef.current.slug,
        });
        setAutoRefresh('error');
        return;
      }

      if (shouldDisableForRateLimit(pageResult)) {
        setAutoRefresh('rate_limit');
        return;
      }
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setTags({
          endpoint: 'api.explore.logs-table',
          errorReason: 'auto-refresh',
          organization: organizationRef.current.slug,
        });
        Sentry.captureException(error);
      });
      setAutoRefresh('error');
    } finally {
      isRefreshRunningRef.current = false;
    }
  }, [
    shouldPauseForVisibility,
    shouldDisableForTimeout,
    shouldDisableForRateLimit,
    setAutoRefresh,
    fetchPreviousPage,
    isError,
  ]);

  const resetTrackingState = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = Date.now();
    consecutivePagesWithMoreDataRef.current = 0;
    isRefreshRunningRef.current = false;
  };

  // Set up the refresh interval
  useEffect(() => {
    resetTrackingState();
    if (autoRefresh === 'enabled') {
      fetchPageWithChecks();
      intervalRef.current = setInterval(fetchPageWithChecks, refreshInterval);
    }

    return () => {
      resetTrackingState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshInterval]);
}
