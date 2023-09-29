import {formatSecondsToClock} from 'sentry/utils/formatters';
import type {ReplayFrame, SpanFrame} from 'sentry/utils/replays/types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export function showPlayerTime(
  timestamp: ConstructorParameters<typeof Date>[0],
  relativeTimeMs: number,
  showMs: boolean = false
): string {
  return formatTime(Math.abs(new Date(timestamp).getTime() - relativeTimeMs), showMs);
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
export function getFramesByColumn(
  durationMs: number,
  frames: ReplayFrame[],
  totalColumns: number
) {
  const safeDurationMs = isNaN(durationMs) ? 1 : durationMs;

  const columnFramePairs = frames.map(frame => {
    const columnPositionCalc =
      Math.floor((frame.offsetMs / safeDurationMs) * (totalColumns - 1)) + 1;

    // Should start at minimum in the first column
    const column = Math.max(1, columnPositionCalc);

    return [column, frame] as [number, ReplayFrame];
  });

  const framesByColumn = columnFramePairs.reduce<Map<number, ReplayFrame[]>>(
    (map, [column, frame]) => {
      if (map.has(column)) {
        map.get(column)?.push(frame);
      } else {
        map.set(column, [frame]);
      }
      return map;
    },
    new Map()
  );

  return framesByColumn;
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
  frameCount: number;
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

export function flattenFrames(frames: SpanFrame[]): FlattenedSpanRange[] {
  if (!frames.length) {
    return [];
  }

  const [first, ...rest] = frames.map((span): FlattenedSpanRange => {
    return {
      frameCount: 1,
      startTimestamp: span.timestampMs,
      endTimestamp: span.endTimestampMs,
      duration: span.endTimestampMs - span.timestampMs,
    };
  });

  const flattened = [first];

  for (const span of rest) {
    let overlap = false;
    for (const range of flattened) {
      if (doesOverlap(range, span)) {
        overlap = true;
        range.frameCount += 1;
        range.startTimestamp = Math.min(range.startTimestamp, span.startTimestamp);
        range.endTimestamp = Math.max(range.endTimestamp, span.endTimestamp);
        range.duration = range.endTimestamp - range.startTimestamp;
        break;
      }
    }
    if (!overlap) {
      flattened.push(span);
    }
  }
  return flattened;
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
