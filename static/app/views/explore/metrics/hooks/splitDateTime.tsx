import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

type DateTimeFilter = PageFilters['datetime'];

export interface TimeChunkPolicy {
  /**
   * Each older window is this many times larger than the previous one, so the
   * newest window (which paints first) is the smallest.
   */
  growthFactor?: number;
  /**
   * Size of the newest window, in buckets.
   */
  initialBuckets?: number;
  /**
   * Cap on the number of windows, to bound request fan-out. The oldest window
   * absorbs whatever range is left over.
   */
  maxChunks?: number;
  /**
   * Ranges narrower than this (in buckets) aren't split — a single request is
   * already fast, so the original datetime is returned unchanged.
   */
  minBucketsToChunk?: number;
}

/**
 * Splits a page-filter datetime into epoch-aligned, whole-bucket sub-windows for
 * parallel, streamed fetching. Each returned datetime is a drop-in replacement
 * for `selection.datetime`: spread it back onto a `PageFilters` and hand it to any
 * range-based query builder.
 *
 * A range not worth splitting — narrow, or an unparseable interval — returns the
 * ORIGINAL datetime unchanged as a single-element array. So a relative range stays
 * relative (keeps its `statsPeriod`) and the caller's single-request fast path is
 * byte-for-byte today's behavior. Split ranges resolve to absolute windows
 * (`start`/`end` Dates, no `period`), newest-first and growing older-ward so the
 * smallest/newest window resolves first.
 *
 * Epoch alignment is mandatory. Verified against the EAP backend (July 2025):
 * Snuba anchors each time bucket to the REQUEST's start, not the epoch —
 * `bucket = start + floor((ts - start) / g) * g`
 * (snuba `resolvers/R_eap_items/resolver_time_series.py`). On the Sentry side,
 * `rpc_dataset_common` floors start / ceils end to the epoch granularity grid
 * before the RPC, but only when `stable_timestamp_quantization` is on (it
 * defaults on). Either way, if two adjacent windows are handed boundaries that
 * are NOT shared multiples of the interval from the epoch, their buckets fall on
 * different phases and the seam bucket is duplicated or dropped.
 *
 * By epoch-aligning here (floor the outer start, ceil the outer end, step by
 * whole buckets) every window's start is itself a multiple of the granularity, so
 * `start + k*g` lands on the epoch grid regardless of that backend flag, and
 * adjacent windows share the exact same edge — no overlap, gap, or double-count.
 * The interval MUST be a granularity the backend accepts (`VALID_GRANULARITIES`
 * in sentry / `_VALID_GRANULARITY_SECS` in snuba) or the query is rejected.
 */
export function splitDateTime(
  datetime: DateTimeFilter,
  interval: string,
  policy?: TimeChunkPolicy
): DateTimeFilter[] {
  const intervalMs = intervalToMilliseconds(interval);
  const range = resolveAbsoluteRange(datetime);
  if (intervalMs <= 0 || !range) {
    return [datetime];
  }

  const {initialBuckets, growthFactor, maxChunks, minBucketsToChunk} = {
    ...DEFAULT_POLICY,
    ...policy,
  };

  const alignedStart = Math.floor(range.start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(range.end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);

  if (totalBuckets < minBucketsToChunk) {
    return [datetime];
  }

  const windows: DateTimeFilter[] = [];
  let cursor = alignedEnd;
  let spanBuckets = initialBuckets;

  // Reserve the final slot for the oldest window so it can swallow the remainder
  // rather than leaving a tiny sliver uncovered.
  while (cursor > alignedStart && windows.length < maxChunks - 1) {
    const remainingBuckets = Math.round((cursor - alignedStart) / intervalMs);
    const chunkBuckets = Math.min(spanBuckets, remainingBuckets);
    const chunkStart = cursor - chunkBuckets * intervalMs;
    windows.push(toWindow(chunkStart, cursor, datetime.utc));
    cursor = chunkStart;
    spanBuckets *= growthFactor;
  }

  if (cursor > alignedStart) {
    windows.push(toWindow(alignedStart, cursor, datetime.utc));
  }

  return windows;
}

const DEFAULT_POLICY: Required<TimeChunkPolicy> = {
  initialBuckets: 15,
  growthFactor: 3,
  maxChunks: 5,
  minBucketsToChunk: 60,
};

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
