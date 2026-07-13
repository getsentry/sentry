import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

type DateTimeFilter = PageFilters['datetime'];

/**
 * The exact `/events-heatmap/` time params for one window — an absolute range, a
 * relative window ending in the past, or a relative window running to now. Spread
 * straight into the request query.
 */
export type HeatmapWindow =
  | {end: string; start: string}
  | {statsPeriodEnd: string; statsPeriodStart: string}
  | {statsPeriod: string};

/** An epoch-ms time span (the heat map's x-axis extent). */
export interface TimeDomain {
  end: number;
  start: number;
}

export interface MetricHeatmapPlan {
  /**
   * Full epoch-aligned time domain in ms, used to size the merged grid. Returned
   * (rather than re-derived by the caller) because a relative range's windows are
   * `statsPeriod` offsets with no absolute anchor — only the partitioner, which
   * resolved `now`, knows the concrete ms extent. `{0, 0}` when there's nothing to
   * partition (fast path / empty), which merges nothing.
   */
  timeDomain: TimeDomain;
  windows: HeatmapWindow[];
}

/**
 * How to size the partitions:
 * - `equal`: roughly equal-sized windows.
 * - `progressive`: newest window smallest, each older one ~`GROWTH_FACTOR`×
 *   larger, so the most-looked-at (recent) region loads first.
 */
type PartitionStrategy = 'equal' | 'progressive';

/**
 * Partitions a page-filter datetime into the per-chunk `/events-heatmap/` time
 * params for parallel, streamed fetching, preserving the range's nature:
 *
 * - ABSOLUTE ranges → epoch-aligned, non-overlapping `{start, end}` windows.
 *   Aligned seams land on bucket boundaries, so the backend's row filter never
 *   splits a bucket — no overlap needed.
 * - RELATIVE ranges → `{statsPeriodStart, statsPeriodEnd}` (or `{statsPeriod}` for
 *   the live edge) windows. The backend resolves `now` fresh each fetch, so the
 *   data refreshes and `staleTime` works without pinning an absolute edge. But a
 *   relative seam (`now − Nd`) is never grid-aligned, so the backend's row filter
 *   (built from the un-rounded bound) bisects the seam bucket. To fix that, each
 *   window overlaps its newer neighbor by `RELATIVE_OVERLAP_BUCKETS` so every
 *   bucket is complete in ≥1 chunk; the merge picks the complete copy.
 *
 * A range shorter than `MINIMUM_PARTITION_RANGE` returns a single window with the
 * selection's own params — byte-for-byte today's request. No usable interval
 * returns nothing to fetch.
 */
export function partitionHeatmapWindows(
  datetime: DateTimeFilter,
  interval: string | null | undefined,
  strategy: PartitionStrategy
): MetricHeatmapPlan {
  const intervalMs = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const normalized = normalizeDateTimeParams(datetime);
  const domain = resolveAbsoluteDomain(normalized, datetime);

  if (intervalMs <= 0) {
    return EMPTY_PLAN;
  }
  if (!domain || domain.end - domain.start < MINIMUM_PARTITION_RANGE) {
    return {windows: [selectionWindow(normalized)], timeDomain: {start: 0, end: 0}};
  }

  const alignedStart = Math.floor(domain.start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(domain.end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);
  const bucketWidths = distributeBuckets(totalBuckets, strategy);

  const isAbsolute = defined(normalized.start) && defined(normalized.end);
  const windows = isAbsolute
    ? absoluteWindows(alignedStart, bucketWidths, intervalMs)
    : relativeWindows(bucketWidths, intervalMs);

  return {windows, timeDomain: {start: alignedStart, end: alignedEnd}};
}

/** The whole selection as a single window — the un-chunked fast path. */
function selectionWindow(
  normalized: ReturnType<typeof normalizeDateTimeParams>
): HeatmapWindow {
  if (defined(normalized.start) && defined(normalized.end)) {
    return {start: normalized.start, end: normalized.end};
  }
  return {statsPeriod: normalized.statsPeriod ?? ''};
}

/**
 * Splits `totalBuckets` across (up to) `CHUNK_COUNT` windows, newest/smallest
 * first, with the oldest window taking the remainder. e.g. 720 buckets →
 * progressive (weights 1:3:9:27:81): `[6, 18, 54, 161, 481]`; equal: `[144, 144,
 * 144, 144, 144]`.
 */
function distributeBuckets(totalBuckets: number, strategy: PartitionStrategy): number[] {
  const weights = Array.from({length: CHUNK_COUNT}, (_, i) =>
    strategy === 'progressive' ? GROWTH_FACTOR ** i : 1
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const bucketWidths: number[] = [];
  let remaining = totalBuckets;
  for (let i = 0; i < CHUNK_COUNT - 1 && remaining > 0; i++) {
    // This window's weighted share of the total, floored at 1 bucket and capped
    // at what's left. e.g. progressive 720: 6 (=round(720/121)), 18, 54, 161, then
    // the oldest window takes the remaining 481.
    const target = Math.round((totalBuckets * weights[i]!) / weightSum);
    const width = Math.min(Math.max(target, 1), remaining);
    bucketWidths.push(width);
    remaining -= width;
  }
  if (remaining > 0) {
    bucketWidths.push(remaining);
  }
  return bucketWidths;
}

/**
 * Non-overlapping absolute windows walking oldest→newest from the start. Order
 * within the array doesn't matter — requests fire in parallel and the merge keys
 * cells by timestamp.
 */
function absoluteWindows(
  alignedStart: number,
  bucketWidths: number[],
  intervalMs: number
): HeatmapWindow[] {
  // bucketWidths are newest-first (smallest first); reverse so the largest
  // (oldest) window sits at the start.
  const windows: HeatmapWindow[] = [];
  let cursor = alignedStart;
  for (const width of bucketWidths.toReversed()) {
    const end = cursor + width * intervalMs;
    windows.push({start: getUtcDateString(cursor), end: getUtcDateString(end)});
    cursor = end;
  }
  return windows;
}

/**
 * Relative windows as `statsPeriod*` offsets (seconds ago), newest-first. Each
 * window's newer edge is pulled `RELATIVE_OVERLAP_BUCKETS` toward now to overlap
 * its neighbor; when that would cross now it just runs to now (`statsPeriod`).
 * Order within the array doesn't matter (see `absoluteWindows`).
 */
function relativeWindows(bucketWidths: number[], intervalMs: number): HeatmapWindow[] {
  const overlapMs = RELATIVE_OVERLAP_BUCKETS * intervalMs;
  const windows: HeatmapWindow[] = [];
  let newerOffsetMs = 0;
  for (const width of bucketWidths) {
    const olderOffsetMs = newerOffsetMs + width * intervalMs;
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
 * Resolves a datetime to concrete epoch-ms bounds for sizing (the x-axis domain).
 * Absolute ranges parse as UTC (`normalizeDateTimeParams` emits UTC strings
 * without a `Z`); relative ranges anchor `end` to now and subtract the period — a
 * snapshot used only to size the range, never sent (relative windows stay
 * relative). Returns null for a domain that can't be resolved to a positive span.
 */
function resolveAbsoluteDomain(
  normalized: ReturnType<typeof normalizeDateTimeParams>,
  datetime: DateTimeFilter
): {end: number; start: number} | null {
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
const CHUNK_COUNT = 5;
// For the `progressive` strategy: each older window is this many times larger
// than the one after it.
const GROWTH_FACTOR = 3;
// Ranges shorter than this aren't worth partitioning — a single request is fast.
const MINIMUM_PARTITION_RANGE = 1000 * 60 * 60 * 24; // 1 day
// Relative windows overlap their newer neighbor by this many buckets so the seam
// bucket (which the backend's row filter would otherwise split — see
// mergeHeatMapChunks) lands complete in at least one chunk. Two absorbs the
// millisecond `now` skew between the parallel requests.
const RELATIVE_OVERLAP_BUCKETS = 2;

// Nothing to fetch — no usable interval.
const EMPTY_PLAN: MetricHeatmapPlan = {windows: [], timeDomain: {start: 0, end: 0}};
