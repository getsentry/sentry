import moment from 'moment-timezone';

import type {Event} from 'sentry/types/event';

import type {TimeWindow} from '../types';

// Stores the elapsed minutes for each selectable resolution
export const resolutionElapsedMinutes: Record<TimeWindow, number> = {
  '1h': 60,
  '24h': 60 * 24,
  '7d': 60 * 24 * 7,
  '30d': 60 * 24 * 30,
};

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
