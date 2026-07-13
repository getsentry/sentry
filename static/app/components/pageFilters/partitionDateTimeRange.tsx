import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

type DateTimeFilter = PageFilters['datetime'];

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
// Ranges shorter than this aren't worth partitioning — a single request is fast,
// so the original datetime is returned unchanged.
const MINIMUM_PARTITION_RANGE = 1000 * 60 * 60 * 24; // 1 day

/**
 * Splits a page-filter datetime into epoch-aligned, whole-bucket sub-windows for
 * parallel, streamed fetching. Each returned datetime is a drop-in replacement
 * for `selection.datetime`: spread it back onto a `PageFilters` and hand it to any
 * range-based query builder.
 *
 * A range not worth partitioning — shorter than `MINIMUM_PARTITION_RANGE`, or an
 * unparseable interval — returns the ORIGINAL datetime unchanged as a
 * single-element array. So a relative range stays relative (keeps its
 * `statsPeriod`). Partitioned ranges resolve to absolute windows (`start`/`end`
 * Dates, no `period`), newest-first.
 *
 * Epoch alignment is mandatory when the windows feed a bucketed time-series query.
 * Verified against the EAP backend (July 2025): Snuba anchors each time bucket to
 * the REQUEST's start, not the epoch — `bucket = start + floor((ts - start)/g)*g`
 * (snuba `resolvers/R_eap_items/resolver_time_series.py`). On the Sentry side,
 * `rpc_dataset_common` floors start / ceils end to the epoch granularity grid
 * before the RPC, but only when `stable_timestamp_quantization` is on (it
 * defaults on). Either way, if two adjacent windows are handed boundaries that are
 * NOT shared multiples of the interval from the epoch, their buckets fall on
 * different phases and the seam bucket is duplicated or dropped.
 *
 * By epoch-aligning here (floor the outer start, ceil the outer end, step by whole
 * buckets) every window's start is itself a multiple of the granularity, so
 * `start + k*g` lands on the epoch grid regardless of that backend flag, and
 * adjacent windows share the exact same edge — no overlap, gap, or double-count.
 */
export function partitionDateTimeRange(
  datetime: DateTimeFilter,
  interval: string,
  strategy: PartitionStrategy
): DateTimeFilter[] {
  const intervalMs = intervalToMilliseconds(interval);
  const range = resolveAbsoluteRange(datetime);
  if (intervalMs <= 0 || !range || range.end - range.start < MINIMUM_PARTITION_RANGE) {
    return [datetime];
  }

  const alignedStart = Math.floor(range.start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(range.end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);

  // `equal` weights every window the same; `progressive` grows them geometrically.
  // Either way, distribute buckets by weight (newest/smallest first) and let the
  // oldest window take the remainder, so coverage is exact and every edge stays on
  // the bucket grid.
  const weights = Array.from({length: CHUNK_COUNT}, (_, i) =>
    strategy === 'progressive' ? GROWTH_FACTOR ** i : 1
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const windows: DateTimeFilter[] = [];
  let cursor = alignedEnd;
  for (let i = 0; i < CHUNK_COUNT - 1 && cursor > alignedStart; i++) {
    const remainingBuckets = Math.round((cursor - alignedStart) / intervalMs);
    const targetBuckets = Math.round((totalBuckets * weights[i]!) / weightSum);
    const chunkBuckets = Math.min(Math.max(targetBuckets, 1), remainingBuckets);
    const chunkStart = cursor - chunkBuckets * intervalMs;
    windows.push(toWindow(chunkStart, cursor, datetime.utc));
    cursor = chunkStart;
  }

  if (cursor > alignedStart) {
    windows.push(toWindow(alignedStart, cursor, datetime.utc));
  }

  return windows;
}

/**
 * Resolves a page-filter datetime to concrete epoch-ms bounds. Absolute ranges
 * parse as UTC (`normalizeDateTimeParams` emits UTC strings without a `Z`);
 * relative ranges anchor `end` to now and subtract the period. Returns null for a
 * range that can't be resolved to a positive span.
 */
function resolveAbsoluteRange(
  datetime: DateTimeFilter
): {end: number; start: number} | null {
  const normalized = normalizeDateTimeParams(datetime);
  if (defined(normalized.start) && defined(normalized.end)) {
    const start = moment.utc(normalized.start).valueOf();
    const end = moment.utc(normalized.end).valueOf();
    return start < end ? {start, end} : null;
  }
  const end = Date.now();
  const start = end - getDiffInMinutes(datetime) * 60 * 1000;
  return start < end ? {start, end} : null;
}

function toWindow(startMs: number, endMs: number, utc: boolean | null): DateTimeFilter {
  return {start: new Date(startMs), end: new Date(endMs), period: null, utc};
}
