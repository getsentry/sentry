import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

type DateTimeFilter = PageFilters['datetime'];

/**
 * A loading window for a Heat Map visualization. Heat Maps load data in
 * "chunks" by windowing the X-axis time range, and loading them in parallel. A
 * window can be absolute, or relative.
 */
export type HeatMapWindow =
  | {end: string; start: string}
  | {statsPeriodEnd: string; statsPeriodStart: string}
  | {statsPeriod: string};

/** An epoch-ms time span (the heat map's X-axis domain) */
export interface TimeDomain {
  end: number;
  start: number;
}

export interface MetricHeatMapPlan {
  /**
   * Full epoch-aligned time domain in ms, used to size the merged grid. Returned
   * (rather than derived by the caller) because a relative range's windows are
   * `statsPeriod` offsets with no absolute anchor, so only the partitioner —
   * which resolved `now` — knows the concrete extent. `{0, 0}` when there's
   * nothing to partition (fast path / empty), which merges nothing.
   */
  timeDomain: TimeDomain;
  windows: HeatMapWindow[];
}

/**
 * How to size the partitions:
 * - `equal`: roughly equal-sized windows
 * - `progressive`: newer windows smaller, so they load earlier
 */
type PartitionStrategy = 'equal' | 'progressive';

/**
 * Partitions a page-filter datetime into the per-chunk time params for
 * parallel, streamed fetching, preserving the range's nature:
 *
 * Absolute ranges become epoch-aligned, non-overlapping `{start, end}`
 * windows. Aligned seams land on bucket boundaries so there are no gaps or
 * overlaps.
 * Relative ranges become `{statsPeriodStart, statsPeriodEnd}` (or
 * `{statsPeriod}` for the live edge) windows. Windows slightly overlap each
 * other to cover the case where these relative ranges split the bucket
 * boundaries.
 *
 * Short ranges return a single window with the selection's own params. No usable interval returns nothing to fetch.
 */
export function partitionDateTimeIntoHeatMapWindows(
  datetime: DateTimeFilter,
  interval: string | null | undefined,
  strategy: PartitionStrategy
): MetricHeatMapPlan {
  const intervalMs = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const normalized = normalizeDateTimeParams(datetime);
  const timeDomain = pageFilterDateTimeToTimeDomain(normalized, datetime);

  if (intervalMs <= 0) {
    return {windows: [], timeDomain: {start: 0, end: 0}};
  }

  if (!timeDomain || timeDomain.end - timeDomain.start < MINIMUM_PARTITION_RANGE) {
    return {
      windows: [dateTimeAsHeatMapWindow(datetime)],
      timeDomain: {start: 0, end: 0},
    };
  }

  const alignedStart = Math.floor(timeDomain.start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(timeDomain.end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);
  const bucketDistribution = distributeBucketCount(totalBuckets, strategy);

  const isAbsolute = defined(normalized.start) && defined(normalized.end);

  const windows = isAbsolute
    ? absoluteWindows(alignedStart, bucketDistribution, intervalMs)
    : relativeWindows(bucketDistribution, intervalMs);

  return {windows, timeDomain: {start: alignedStart, end: alignedEnd}};
}

/**
 * The whole selection as one un-chunked window — the narrow-range fast path, and
 * the fallback the caller fires just-in-time when a wide range's bounds are
 * unavailable (empty or errored).
 */
export function dateTimeAsHeatMapWindow(datetime: DateTimeFilter): HeatMapWindow {
  const {start, end, statsPeriod} = normalizeDateTimeParams(datetime);
  if (defined(start) && defined(end)) {
    return {start, end};
  }

  return {statsPeriod: statsPeriod ?? ''};
}

/**
 * Splits buckets across windows, newest/smallest first, with the oldest window
 * taking the remainder. Returns the per-window bucket counts. e.g., 720 buckets
 * becomes progressive (weights 1:3:9): `[55, 166, 499]`; equal: `[240, 240,
 * 240]`.
 */
function distributeBucketCount(
  totalBuckets: number,
  strategy: PartitionStrategy
): number[] {
  const weights = Array.from({length: CHUNK_COUNT}, (_, i) =>
    strategy === 'progressive' ? GROWTH_FACTOR ** i : 1
  );

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const bucketDistribution: number[] = [];
  let remaining = totalBuckets;

  for (let i = 0; i < CHUNK_COUNT - 1 && remaining > 0; i++) {
    // This window's weighted share of the total, floored at 1 bucket and capped
    // at what's left. e.g., progressive 720: 55 (=round(720/13)), 166, then the
    // oldest window takes the remaining 499.
    const target = Math.round((totalBuckets * weights[i]!) / weightSum);
    const count = Math.min(Math.max(target, 1), remaining);
    bucketDistribution.push(count);
    remaining -= count;
  }

  if (remaining > 0) {
    bucketDistribution.push(remaining);
  }

  return bucketDistribution;
}

/**
 * Non-overlapping absolute windows walking oldest to newest from the start.
 */
function absoluteWindows(
  alignedStart: number,
  bucketDistribution: number[],
  intervalMs: number
): HeatMapWindow[] {
  const windows: HeatMapWindow[] = [];

  let cursor = alignedStart;
  for (const count of bucketDistribution.toReversed()) {
    const end = cursor + count * intervalMs;
    windows.push({start: getUtcDateString(cursor), end: getUtcDateString(end)});
    cursor = end;
  }

  return windows;
}

/**
 * Relative windows as `statsPeriod*` offsets, newest-first. Each window's newer
 * edge is pulled `RELATIVE_OVERLAP_BUCKETS` toward now to overlap its neighbor;
 * when that would cross now it just runs to now (`statsPeriod`).
 */
function relativeWindows(
  bucketDistribution: number[],
  intervalMs: number
): HeatMapWindow[] {
  const overlapMs = RELATIVE_OVERLAP_BUCKETS * intervalMs;
  const windows: HeatMapWindow[] = [];

  let newerOffsetMs = 0;
  for (const count of bucketDistribution) {
    const olderOffsetMs = newerOffsetMs + count * intervalMs;
    const endOffsetMs = newerOffsetMs - overlapMs;

    windows.push(
      endOffsetMs > 0
        ? {
            statsPeriodStart: secondsAgo(olderOffsetMs),
            statsPeriodEnd: secondsAgo(endOffsetMs),
          }
        : {statsPeriod: secondsAgo(olderOffsetMs)}
    );
    newerOffsetMs = olderOffsetMs;
  }

  return windows;
}

const secondsAgo = (ms: number) => `${Math.round(ms / 1000)}s`;

/**
 * Resolves a datetime page filter to concrete epoch-ms bounds for sizing (the
 * x-axis domain). Absolute ranges parse as UTC (`normalizeDateTimeParams` emits
 * UTC strings without a `Z`); relative ranges anchor `end` to now and subtract
 * the period — a snapshot used only to size the range, never sent (relative
 * windows stay relative). Returns null for a domain that can't be resolved to a
 * positive span.
 */
function pageFilterDateTimeToTimeDomain(
  normalized: ReturnType<typeof normalizeDateTimeParams>,
  datetime: DateTimeFilter
): TimeDomain | null {
  if (defined(normalized.start) && defined(normalized.end)) {
    const start = moment.utc(normalized.start).valueOf();
    const end = moment.utc(normalized.end).valueOf();
    return start < end ? {start, end} : null;
  }
  const end = Date.now();
  const start = end - getDiffInMinutes(datetime) * 60 * 1000;
  return start < end ? {start, end} : null;
}

// Number of windows a partitioned range is split into.
const CHUNK_COUNT = 3;

// For the `progressive` strategy: each older window is this many times larger
// than the one after it.
const GROWTH_FACTOR = 3;

// Ranges shorter than this aren't worth partitioning — a single request is fast.
const MINIMUM_PARTITION_RANGE = 1000 * 60 * 60 * 24; // 1 day

// Relative windows overlap their newer neighbor by this many buckets.
const RELATIVE_OVERLAP_BUCKETS = 2;
