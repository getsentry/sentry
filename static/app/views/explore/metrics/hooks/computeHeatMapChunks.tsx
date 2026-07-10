import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

export interface HeatMapChunk {
  /**
   * Chunk end, epoch-aligned to `interval`, exclusive-ish. In ms.
   */
  end: number;
  /**
   * Chunk start, epoch-aligned to `interval`. In ms.
   */
  start: number;
}

interface ComputeHeatMapChunksOptions {
  /**
   * Range end. In ms.
   */
  end: number;
  /**
   * The shared heat map interval (e.g. `1h`). Every chunk uses this exact
   * interval, which is what keeps buckets aligned across chunks.
   */
  interval: string;
  /**
   * Range start. In ms.
   */
  start: number;
}

// Ranges narrower than this (in buckets/columns) aren't worth splitting; a
// single request is already fast. Keeping them as one chunk lets callers reuse
// today's single-request behavior.
const MIN_TOTAL_BUCKETS_TO_CHUNK = 60;

// The newest chunk is the smallest so the most-looked-at (recent) region loads
// fastest, then each older chunk grows by GROWTH_FACTOR. Fan-out is capped by
// MAX_CHUNKS; the oldest chunk absorbs whatever range is left.
const INITIAL_CHUNK_BUCKETS = 15;
const GROWTH_FACTOR = 3;
const MAX_CHUNKS = 5;

/**
 * Splits a time range into epoch-aligned, whole-bucket chunks for parallel heat
 * map fetching.
 *
 * Epoch alignment is mandatory: the heat map endpoint floors each request's
 * start and ceils its end to `interval` multiples measured from the Unix epoch
 * (see `rpc_dataset_common` in the backend). If a chunk boundary doesn't land
 * on that grid, the two adjacent chunks round onto the *same* seam bucket and
 * emit a duplicate row once concatenated. Flooring the outer start / ceiling the
 * outer end and stepping by whole buckets guarantees every edge is on the grid,
 * so the backend's rounding is a no-op.
 *
 * Chunks are returned newest-first and grow older-ward, so the smallest/newest
 * chunk resolves first.
 */
export function computeHeatMapChunks({
  start,
  end,
  interval,
}: ComputeHeatMapChunksOptions): HeatMapChunk[] {
  const intervalMs = intervalToMilliseconds(interval);
  if (intervalMs <= 0 || start >= end) {
    return [];
  }

  const alignedStart = Math.floor(start / intervalMs) * intervalMs;
  const alignedEnd = Math.ceil(end / intervalMs) * intervalMs;
  const totalBuckets = Math.round((alignedEnd - alignedStart) / intervalMs);

  if (totalBuckets < MIN_TOTAL_BUCKETS_TO_CHUNK) {
    return [{start: alignedStart, end: alignedEnd}];
  }

  const chunks: HeatMapChunk[] = [];
  let cursor = alignedEnd;
  let spanBuckets = INITIAL_CHUNK_BUCKETS;

  // Reserve the final slot for the oldest chunk so it can swallow the remainder
  // rather than leaving a tiny sliver uncovered.
  while (cursor > alignedStart && chunks.length < MAX_CHUNKS - 1) {
    const remainingBuckets = Math.round((cursor - alignedStart) / intervalMs);
    const chunkBuckets = Math.min(spanBuckets, remainingBuckets);
    const chunkStart = cursor - chunkBuckets * intervalMs;
    chunks.push({start: chunkStart, end: cursor});
    cursor = chunkStart;
    spanBuckets *= GROWTH_FACTOR;
  }

  if (cursor > alignedStart) {
    chunks.push({start: alignedStart, end: cursor});
  }

  return chunks;
}
