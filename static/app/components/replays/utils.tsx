import {Crumb} from 'sentry/types/breadcrumbs';
import {formatSecondsToClock} from 'sentry/utils/formatters';
import type {ReplaySpan} from 'sentry/views/replays/types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * @param timestamp The timestamp that is our reference point. Can be anything that `moment` accepts such as `'2022-05-04T19:47:52.915000Z'` or `1651664872.915`
 * @param diffMs Number of milliseconds to adjust the timestamp by, either positive (future) or negative (past)
 * @returns Unix timestamp of the adjusted timestamp, in milliseconds
 */
export function relativeTimeInMs(
  timestamp: ConstructorParameters<typeof Date>[0],
  diffMs: number
): number {
  return Math.abs(new Date(timestamp).getTime() - diffMs);
}

export function showPlayerTime(
  timestamp: ConstructorParameters<typeof Date>[0],
  relativeTimeMs: number,
  showMs: boolean = false
): string {
  return formatTime(relativeTimeInMs(timestamp, relativeTimeMs), showMs);
}

export function formatTime(ms: number, showMs?: boolean): string {
  if (ms <= 0 || isNaN(ms)) {
    if (showMs) {
      return '00:00.000';
    }

    return '00:00';
  }

  const seconds = ms / 1000;
  return formatSecondsToClock(showMs ? seconds : Math.floor(seconds));
}

/**
 * Figure out how many ticks to show in an area.
 * If there is more space available, we can show more granular ticks, but if
 * less space is available, fewer ticks.
 * Similarly if the duration is short, the ticks will represent a short amount
 * of time (like every second) but if the duration is long one tick may
 * represent an hour.
 *
 * @param durationMs The amount of time that we need to chop up into even sections
 * @param width Total width available, pixels
 * @param minWidth Minimum space for each column, pixels. Ex: So we can show formatted time like `1:00:00` between major ticks
 * @returns
 */
export function countColumns(durationMs: number, width: number, minWidth: number = 50) {
  let maxCols = Math.floor(width / minWidth);
  const remainder = durationMs - maxCols * width > 0 ? 1 : 0;
  maxCols -= remainder;

  // List of all the possible time granularities to display
  // We could generate the list, which is basically a version of fizzbuzz, hard-coding is quicker.
  const timeOptions = [
    1 * HOUR,
    30 * MINUTE,
    20 * MINUTE,
    15 * MINUTE,
    10 * MINUTE,
    5 * MINUTE,
    2 * MINUTE,
    1 * MINUTE,
    30 * SECOND,
    10 * SECOND,
    5 * SECOND,
    1 * SECOND,
  ];

  const timeBasedCols = timeOptions.reduce<Map<number, number>>((map, time) => {
    map.set(time, Math.floor(durationMs / time));
    return map;
  }, new Map());

  const [timespan, cols] = Array.from(timeBasedCols.entries())
    .filter(([_span, c]) => c <= maxCols) // Filter for any valid timespan option where all ticks would fit
    .reduce((best, next) => (next[1] > best[1] ? next : best), [0, 0]); // select the timespan option with the most ticks

  const remaining = (durationMs - timespan * cols) / timespan;
  return {timespan, cols, remaining};
}

/**
 * Group Crumbs for display along the timeline.
 *
 * The timeline is broken down into columns (aka buckets, or time-slices).
 * Columns translate to a fixed width on the screen, to prevent side-scrolling.
 *
 * This function groups crumbs into columns based on the number of columns available
 * and the timestamp of the crumb.
 */
export function getCrumbsByColumn(
  startTimestampMs: number,
  durationMs: number,
  crumbs: Crumb[],
  totalColumns: number
) {
  const safeDurationMs = isNaN(durationMs) ? 1 : durationMs;

  const columnCrumbPairs = crumbs.map(breadcrumb => {
    const {timestamp} = breadcrumb;
    const timestampMilliSeconds = +new Date(String(timestamp));
    const sinceStart = isNaN(timestampMilliSeconds)
      ? 0
      : timestampMilliSeconds - startTimestampMs;

    const columnPositionCalc =
      Math.floor((sinceStart / safeDurationMs) * (totalColumns - 1)) + 1;

    // Should start at minimum in the first column
    const column = Math.max(1, columnPositionCalc);

    return [column, breadcrumb] as [number, Crumb];
  });

  const crumbsByColumn = columnCrumbPairs.reduce((map, [column, breadcrumb]) => {
    if (map.has(column)) {
      map.get(column)?.push(breadcrumb);
    } else {
      map.set(column, [breadcrumb]);
    }
    return map;
  }, new Map() as Map<number, Crumb[]>);

  return crumbsByColumn;
}

type FlattenedSpanRange = {
  /**
   * Duration of this range
   */
  duration: number;
  /**
   * Absolute time in ms when the range ends
   */
  endTimestamp: number;
  /**
   * Number of spans that got flattened into this range
   */
  spanCount: number;
  /**
   * ID of the original span that created this range
   */
  spanId: string;
  //
  /**
   * Absolute time in ms when the span starts
   */
  startTimestamp: number;
};

function doesOverlap(a: FlattenedSpanRange, b: FlattenedSpanRange) {
  const bStartsWithinA =
    a.startTimestamp <= b.startTimestamp && b.startTimestamp <= a.endTimestamp;
  const bEndsWithinA =
    a.startTimestamp <= b.endTimestamp && b.endTimestamp <= a.endTimestamp;
  return bStartsWithinA || bEndsWithinA;
}

export function flattenSpans(rawSpans: ReplaySpan[]): FlattenedSpanRange[] {
  if (!rawSpans.length) {
    return [];
  }

  const spans = rawSpans.map(span => {
    const startTimestamp = span.startTimestamp * 1000;

    // `endTimestamp` is at least msPerPixel wide, otherwise it disappears
    const endTimestamp = span.endTimestamp * 1000;
    return {
      spanCount: 1,
      // spanId: span.span_id,
      startTimestamp,
      endTimestamp,
      duration: endTimestamp - startTimestamp,
    } as FlattenedSpanRange;
  });

  const [firstSpan, ...restSpans] = spans;
  const flatSpans = [firstSpan];

  for (const span of restSpans) {
    let overlap = false;
    for (const fspan of flatSpans) {
      if (doesOverlap(fspan, span)) {
        overlap = true;
        fspan.spanCount += 1;
        fspan.startTimestamp = Math.min(fspan.startTimestamp, span.startTimestamp);
        fspan.endTimestamp = Math.max(fspan.endTimestamp, span.endTimestamp);
        fspan.duration = fspan.endTimestamp - fspan.startTimestamp;
        break;
      }
    }
    if (!overlap) {
      flatSpans.push(span);
    }
  }
  return flatSpans;
}

/**
 * Divide two numbers safely
 */
export function divide(numerator: number, denominator: number | undefined) {
  if (denominator === undefined || isNaN(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}
