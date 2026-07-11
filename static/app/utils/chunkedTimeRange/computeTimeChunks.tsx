import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

export interface TimeChunk {
  /**
   * Chunk end, epoch-aligned to the interval (exclusive-ish). In ms.
   */
  end: number;
  /**
   * Chunk start, epoch-aligned to the interval. In ms.
   */
  start: number;
}

export interface TimeChunkPolicy {
  /**
   * Each older chunk is this many times larger than the previous one, so the
   * newest chunk (which paints first) is the smallest.
   */
  growthFactor?: number;
  /**
   * Size of the newest chunk, in buckets.
   */
  initialBuckets?: number;
  /**
   * Cap on the number of chunks, to bound request fan-out. The oldest chunk
   * absorbs whatever range is left over.
   */
  maxChunks?: number;
  /**
   * Ranges narrower than this (in buckets) aren't split — a single request is
   * already fast, so they return one chunk (behaving like an un-chunked query).
   */
  minBucketsToChunk?: number;
}

const DEFAULT_POLICY: Required<TimeChunkPolicy> = {
  initialBuckets: 15,
  growthFactor: 3,
  maxChunks: 5,
  minBucketsToChunk: 60,
};

interface ComputeTimeChunksOptions {
  /**
   * Range end. In ms.
   */
  end: number;
  /**
   * The shared bucketing interval (e.g. `1h`). Every chunk uses this exact
   * interval, which is what keeps buckets aligned across chunks.
   */
  interval: string;
  /**
   * Range start. In ms.
   */
  start: number;
  policy?: TimeChunkPolicy;
}

/**
 * Splits a time range into epoch-aligned, whole-bucket chunks for parallel,
 * streamed fetching.
 *
 * Epoch alignment is mandatory. Verified against the EAP backend (July 2025):
 * Snuba anchors each time bucket to the REQUEST's start, not the epoch —
 * `bucket = start + floor((ts - start) / g) * g`
 * (snuba `resolvers/R_eap_items/resolver_time_series.py`). On the Sentry side,
 * `rpc_dataset_common` floors start / ceils end to the epoch granularity grid
 * before the RPC, but only when `stable_timestamp_quantization` is on (it
 * defaults on). Either way, if two adjacent chunks are handed boundaries that
 * are NOT shared multiples of the interval from the epoch, their buckets fall on
 * different phases and the seam bucket is duplicated or dropped.
 *
 * By epoch-aligning here (floor the outer start, ceil the outer end, step by
 * whole buckets) every chunk's start is itself a multiple of the granularity, so
 * `start + k*g` lands on the epoch grid regardless of that backend flag, and
 * adjacent chunks share the exact same edge — no overlap, gap, or double-count.
 * The interval MUST be a granularity the backend accepts (`VALID_GRANULARITIES`
 * in sentry / `_VALID_GRANULARITY_SECS` in snuba) or the query is rejected.
 *
 * Chunks are returned newest-first and grow older-ward, so the smallest/newest
 * chunk resolves first.
 */
export function computeTimeChunks({
  start,
  end,
  interval,
  policy,
}: ComputeTimeChunksOptions): TimeChunk[] {
  const {initialBuckets, growthFactor, maxChunks, minBucketsToChunk} = {
    ...DEFAULT_POLICY,
    ...policy,
  };

  const intervalMs = intervalToMilliseconds(interval);
  if (intervalMs <= 0 || start >= end) {
    return [];
  }

  const alignedStart = Math.floor(start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);

  if (totalBuckets < minBucketsToChunk) {
    return [{start: alignedStart, end: alignedEnd}];
  }

  const chunks: TimeChunk[] = [];
  let cursor = alignedEnd;
  let spanBuckets = initialBuckets;

  // Reserve the final slot for the oldest chunk so it can swallow the remainder
  // rather than leaving a tiny sliver uncovered.
  while (cursor > alignedStart && chunks.length < maxChunks - 1) {
    const remainingBuckets = Math.round((cursor - alignedStart) / intervalMs);
    const chunkBuckets = Math.min(spanBuckets, remainingBuckets);
    const chunkStart = cursor - chunkBuckets * intervalMs;
    chunks.push({start: chunkStart, end: cursor});
    cursor = chunkStart;
    spanBuckets *= growthFactor;
  }

  if (cursor > alignedStart) {
    chunks.push({start: alignedStart, end: cursor});
  }

  return chunks;
}
