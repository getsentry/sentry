import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

/**
 * How long data drawn alongside a time series chart stays fresh, so it
 * refetches together with the chart. Keep in sync with useSortedTimeSeries.
 */
export function chartStaleTime(
  {period, start, end}: PageFilters['datetime'],
  interval: string
): number {
  const intervalInMilliseconds = intervalToMilliseconds(interval);
  if (
    defined(period) &&
    !defined(start) &&
    !defined(end) &&
    intervalInMilliseconds !== 0
  ) {
    return intervalInMilliseconds;
  }
  return defined(end) && moment.utc(end).isAfter() ? 0 : Infinity;
}
