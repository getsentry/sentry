import moment from 'moment';

import {Event} from 'sentry/types';
import {TimeWindow} from 'sentry/views/monitors/components/overviewTimeline/types';
import {resolutionElapsedMinutes} from 'sentry/views/monitors/components/overviewTimeline/utils';

/**
 * Given a cron event, current time, and time window, attempt to return a
 * centered date window (start, end) around the event. If the event happened
 * too recently, a last 24h, 1d, 7d, etc window will be returned instead
 */
export function getTimeRangeFromEvent(
  event: Event,
  now: Date,
  timeWindow: TimeWindow
): {end: Date; start: Date} {
  const elapsedMinutes = resolutionElapsedMinutes[timeWindow];
  let end = moment(event.dateReceived).add(elapsedMinutes / 2, 'minute');
  if (end > moment(now)) {
    end = moment(now);
  }
  const start = moment(end).subtract(elapsedMinutes, 'minute');
  return {start: start.toDate(), end: end.toDate()};
}
