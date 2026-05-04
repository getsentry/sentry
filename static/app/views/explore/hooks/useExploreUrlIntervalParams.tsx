import {useCallback} from 'react';

import type {GetAdditionalUrlParams} from 'sentry/components/pageFilters/actions';
import {decodeScalar} from 'sentry/utils/queryString';
import {resolveChartIntervalForDatetime} from 'sentry/utils/useChartInterval';

/**
 * Returns a `getAdditionalUrlParams` callback that writes the chart interval
 * into the URL alongside the page-filter datetime. Pass it to both
 * `PageFiltersContainer` (for mount-time URL sync) and `DatePageFilter` (for
 * user-driven date changes) so the URL always carries an `interval` keyed off
 * the current datetime — without a separate effect racing with other URL
 * writers. Preserves a user-set interval if it's still valid for the new
 * datetime; otherwise falls back to the default for that range.
 */
export function useExploreUrlIntervalParams(): GetAdditionalUrlParams {
  return useCallback(datetime => {
    // Read fresh — `window.location` reflects pending pushState/replaceState
    // calls from same-tick navigations, so we don't see a stale closure.
    const params = new URLSearchParams(window.location.search);
    const currentInterval = decodeScalar(params.get('interval') ?? undefined);
    return {interval: resolveChartIntervalForDatetime(datetime, currentInterval)};
  }, []);
}
