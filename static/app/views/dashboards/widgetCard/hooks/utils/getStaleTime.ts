import {getDiffInMinutes} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {RangeMap} from 'sentry/utils/number/rangeMap';

export function getWidgetStaleTime(pageFilters: PageFilters) {
  const {start, end, period} = pageFilters.datetime;
  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(period);

  if (usesRelativeDateRange) {
    const selectionDuration = getDiffInMinutes(pageFilters.datetime);
    return STALE_TIME_MAP.get(selectionDuration) ?? 1 * 60 * 1000;
  }

  return Infinity;
}

// These stale times are different from the ones we use in Explore and Insights,
// since Dashboards are a little more static (at least for now), so the stale
// time is pretty generous. We want the stale time to be long enough so that
// when people open/close the Widget Builder or the Widget Viewer they get fewer
// reloads, but do get a reload _eventually_. They can always do a page refresh
// to get fresh data. Feel free to change these periodically, and keep an eye on
// the number of API requests outgoing from Dashboards pages.
const STALE_TIME_MAP = new RangeMap<number>([
  {min: 0, max: 60, value: 1 * 60 * 1000},
  {min: 60, max: 24 * 60, value: 2 * 60 * 1000},
  {min: 24 * 60, max: 30 * 24 * 60, value: 5 * 60 * 1000},
  {min: 30 * 24 * 60, max: 60 * 24 * 60, value: 10 * 60 * 1000},
  {min: 60 * 24 * 60, max: Infinity, value: 15 * 60 * 1000},
]);
