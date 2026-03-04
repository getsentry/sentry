import moment from 'moment-timezone';

import {getParser, getTimeFormat} from 'sentry/utils/dates';

/**
 * A cascading formatter for time axis labels. Given a tick timestamp, returns
 * a formatted string whose granularity matches the tick's position. This
 * works by inspecting what "round boundary" the tick falls on:
 *
 * - Midnight on Jan 1 → includes the year: "Jan 1st 2025"
 * - Midnight on any day → date only: "Feb 3rd"
 * - Any round minute → time only: "2:00 PM"
 * - Otherwise → time with seconds: "2:00:30 PM"
 *
 * This approach is stateless — each tick is formatted independently, without
 * knowledge of the other ticks. It relies on tick positions landing on round
 * boundaries, which is guaranteed by both ECharts' built-in tick placement
 * and by {@link generateTimezoneAlignedTicks} (which provides timezone-aware
 * custom tick positions via `customValues`).
 *
 * When a `timezone` is provided, the tick value is interpreted in that
 * timezone. This is important because tick positions from
 * `generateTimezoneAlignedTicks` are at round boundaries in the user's
 * timezone (e.g., midnight IST), not in the browser's local timezone.
 * Without timezone-aware parsing, those ticks would be displayed as
 * non-round browser-local times (e.g., "10:30 AM" PST instead of
 * "12:00 AM" IST).
 *
 * Example label sets for different time ranges:
 *
 * - Days: ["Feb 1st", "Feb 2nd", "Feb 3rd"]
 * - Hours across a day boundary: ["11:00 PM", "Feb 2nd", "1:00 AM"]
 * - Months: ["Mar 1st", "Apr 1st", "May 1st"]
 * - Months across a year boundary: ["Dec 1st", "Jan 1st 2025", "Feb 1st"]
 * - Hours: ["12:00 PM", "1:00 AM", "2:00 AM", "3:00 AM"]
 */
export function formatXAxisTimestamp(
  value: number,
  options: {timezone?: string; utc?: boolean} = {utc: false}
): string {
  const parsed = options.timezone
    ? moment.tz(value, options.timezone)
    : getParser(!options.utc)(value);

  // Cascade from most specific to least specific boundary
  let format = 'MMM Do';

  if (
    parsed.dayOfYear() === 1 &&
    parsed.hour() === 0 &&
    parsed.minute() === 0 &&
    parsed.second() === 0
  ) {
    // Start of a year
    format = 'MMM Do YYYY';
  } else if (
    parsed.day() === 0 &&
    parsed.hour() === 0 &&
    parsed.minute() === 0 &&
    parsed.second() === 0
  ) {
    // Start of a month
    format = 'MMM Do';
  } else if (parsed.hour() === 0 && parsed.minute() === 0 && parsed.second() === 0) {
    // Start of a day
    format = 'MMM Do';
  } else if (parsed.second() === 0) {
    // Hours, minutes
    format = getTimeFormat();
  } else {
    // Hours, minutes, seconds
    format = getTimeFormat({seconds: true});
  }

  return parsed.format(format);
}
