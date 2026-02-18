import type {SeriesOption} from 'echarts';
import moment from 'moment-timezone';

import {getUserTimezone} from 'sentry/utils/dates';

/**
 * Shift a real UTC timestamp into "fake UTC" where the UTC wall-clock
 * matches the wall-clock in the target timezone.
 *
 * Used so ECharts (with useUTC: true) calculates nice tick boundaries
 * that align with the user's configured timezone.
 *
 * Example (user timezone EST = UTC-5):
 *   Real: 2024-01-15 05:00:00 UTC (= midnight EST)
 *   Shifted: 2024-01-15 00:00:00 UTC (midnight "fake UTC")
 *   ECharts sees midnight UTC → places a "nice" tick here
 */
export function shiftTimestampToFakeUtc(timestamp: number, timezone?: string): number {
  const tz = timezone ?? getUserTimezone();
  const offsetMs = moment.tz(timestamp, tz).utcOffset() * 60_000;
  return timestamp + offsetMs;
}

/**
 * Reverse: recover real UTC from a shifted "fake UTC" timestamp.
 */
export function unshiftTimestampFromFakeUtc(shifted: number, timezone?: string): number {
  const tz = timezone ?? getUserTimezone();
  const offsetMs = moment.tz(shifted, tz).utcOffset() * 60_000;
  return shifted - offsetMs;
}

/**
 * Walk ECharts series data and shift every leading timestamp.
 * Handles the common Sentry format: [[timestamp, value, ...], ...]
 * as well as object format: [{name: timestamp, value: [timestamp, ...]}, ...]
 */
export function shiftSeriesData(
  seriesList: SeriesOption[],
  timezone?: string
): SeriesOption[] {
  return seriesList.map(s => {
    if (!('data' in s) || !Array.isArray(s.data)) {
      return s;
    }

    const shiftedData = s.data.map((item: unknown) => {
      if (Array.isArray(item)) {
        // Tuple format: [timestamp, value, ...]
        const [ts, ...rest] = item;
        if (typeof ts === 'number') {
          return [shiftTimestampToFakeUtc(ts, timezone), ...rest];
        }
        return item;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;

        // Object format with name as timestamp
        if (typeof obj.name === 'number') {
          const shifted: Record<string, unknown> = {
            ...obj,
            name: shiftTimestampToFakeUtc(obj.name, timezone),
          };

          // Also shift value[0] if it's a tuple with a timestamp
          if (Array.isArray(obj.value)) {
            const [ts, ...rest] = obj.value;
            if (typeof ts === 'number') {
              shifted.value = [shiftTimestampToFakeUtc(ts, timezone), ...rest];
            }
          }
          return shifted;
        }
      }
      return item;
    });

    return {...s, data: shiftedData} as SeriesOption;
  });
}
