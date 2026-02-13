import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {getStaleTimeForRelativePeriodTable} from 'sentry/views/insights/common/queries/useSpansQuery';

export function getWidgetStaleTime(pageFilters: PageFilters) {
  const {start, end, period} = pageFilters.datetime;
  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(period);
  if (usesRelativeDateRange) {
    return getStaleTimeForRelativePeriodTable(period);
  }
  return Infinity;
}
