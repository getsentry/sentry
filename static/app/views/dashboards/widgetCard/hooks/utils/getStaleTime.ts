import {
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  SIXTY_DAYS,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

export function getWidgetStaleTime(pageFilters: PageFilters) {
  const {start, end, period} = pageFilters.datetime;
  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(period);

  if (usesRelativeDateRange) {
    const selectionDuration = getDiffInMinutes(pageFilters.datetime);
    const staleTimeString = Ladder.getInterval(selectionDuration);
    const staleTimeMilliseconds = intervalToMilliseconds(staleTimeString);
    return staleTimeMilliseconds;
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
const Ladder = new GranularityLadder([
  [SIXTY_DAYS, '15m'],
  [THIRTY_DAYS, '10m'],
  [TWENTY_FOUR_HOURS, '5m'],
  [ONE_HOUR, '2m'],
  [0, '1m'],
]);
