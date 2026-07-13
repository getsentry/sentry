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

/**
 * The resolved fetch plan for one render. `windows.length > 1` means the range was
 * partitioned into chunks; a single window is the un-chunked fast path.
 */
export interface MetricHeatmapPlan {
  /**
   * Full epoch-aligned x-range in ms, used to size the merged grid. Only
   * meaningful when chunked; `{0, 0}` on the fast path (which merges nothing). For
   * relative ranges this is a snapshot — the merge extends it to the live edge.
   */
  fullRange: {end: number; start: number};
  intervalMs: number;
  windows: HeatmapWindow[];
}

/**
 * How to size the partitions:
 * - `equal`: roughly equal-sized windows.
 * - `progressive`: newest window smallest, each older one ~`GROWTH_FACTOR`×
 *   larger, so the most-looked-at (recent) region loads first.
 */
type PartitionStrategy = 'equal' | 'progressive';

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
 * A range shorter than `MINIMUM_PARTITION_RANGE` (or an unparseable interval)
 * returns a single window with the selection's own params — byte-for-byte today's
 * request.
 */
export function partitionHeatmapWindows(
  datetime: DateTimeFilter,
  interval: string,
  strategy: PartitionStrategy
): MetricHeatmapPlan {
  const intervalMs = intervalToMilliseconds(interval);
  const normalized = normalizeDateTimeParams(datetime);
  const range = resolveAbsoluteRange(normalized, datetime);

  if (intervalMs <= 0 || !range || range.end - range.start < MINIMUM_PARTITION_RANGE) {
    return {
      windows: [selectionWindow(normalized)],
      fullRange: {start: 0, end: 0},
      intervalMs,
    };
  }

  const alignedStart = Math.floor(range.start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(range.end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);
  const widths = distributeBuckets(totalBuckets, strategy);

  const isAbsolute = defined(normalized.start) && defined(normalized.end);
  const windows = isAbsolute
    ? absoluteWindows(alignedEnd, widths, intervalMs)
    : relativeWindows(widths, intervalMs);

  return {windows, fullRange: {start: alignedStart, end: alignedEnd}, intervalMs};
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

/** Distributes buckets across `CHUNK_COUNT` windows (newest/smallest first). */
function distributeBuckets(totalBuckets: number, strategy: PartitionStrategy): number[] {
  const weights = Array.from({length: CHUNK_COUNT}, (_, i) =>
    strategy === 'progressive' ? GROWTH_FACTOR ** i : 1
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const widths: number[] = [];
  let remaining = totalBuckets;
  for (let i = 0; i < CHUNK_COUNT - 1 && remaining > 0; i++) {
    const target = Math.round((totalBuckets * weights[i]!) / weightSum);
    const width = Math.min(Math.max(target, 1), remaining);
    widths.push(width);
    remaining -= width;
  }
  if (remaining > 0) {
    widths.push(remaining);
  }
  return widths;
}

/** Non-overlapping absolute windows, newest-first, walking back from the end. */
function absoluteWindows(
  alignedEnd: number,
  widths: number[],
  intervalMs: number
): HeatmapWindow[] {
  const windows: HeatmapWindow[] = [];
  let cursor = alignedEnd;
  for (const width of widths) {
    const chunkStart = cursor - width * intervalMs;
    windows.push({start: getUtcDateString(chunkStart), end: getUtcDateString(cursor)});
    cursor = chunkStart;
  }
  return windows;
}

/**
 * Relative windows as `statsPeriod*` offsets (seconds ago), newest-first. Each
 * window's newer edge is pulled `RELATIVE_OVERLAP_BUCKETS` toward now to overlap
 * its neighbor; when that would cross now it just runs to now (`statsPeriod`).
 */
function relativeWindows(widths: number[], intervalMs: number): HeatmapWindow[] {
  const overlapMs = RELATIVE_OVERLAP_BUCKETS * intervalMs;
  const windows: HeatmapWindow[] = [];
  let newerOffsetMs = 0;
  for (const width of widths) {
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
 * Resolves a datetime to concrete epoch-ms bounds for sizing. Absolute ranges
 * parse as UTC (`normalizeDateTimeParams` emits UTC strings without a `Z`);
 * relative ranges anchor `end` to now and subtract the period — a snapshot used
 * only to size the range, never sent (relative windows stay relative).
 */
function resolveAbsoluteRange(
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
