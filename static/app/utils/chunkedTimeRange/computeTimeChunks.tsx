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
 * Epoch alignment is mandatory: interval-bucketed timeseries endpoints floor
 * each request's start and ceil its end to interval multiples measured from the
 * Unix epoch. If a chunk boundary doesn't land on that grid, the two adjacent
 * chunks round onto the *same* seam bucket and emit a duplicate row once
 * concatenated. Flooring the outer start / ceiling the outer end and stepping by
 * whole buckets guarantees every edge is on the grid, so the endpoint's rounding
 * is a no-op.
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
