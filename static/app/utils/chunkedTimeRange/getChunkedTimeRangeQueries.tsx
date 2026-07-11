import type {UseQueryOptions} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {TimeChunk} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';
import type {
  ResolvedTimeChunks,
  TimeRange,
} from 'sentry/utils/chunkedTimeRange/useTimeChunks';
import {RequestError} from 'sentry/utils/requestError/requestError';

export interface ChunkQueryContext {
  chunk: TimeChunk;
  /**
   * True when more than one chunk is being fetched. When false the caller
   * typically issues a single request over the whole selection (fast path).
   */
  chunked: boolean;
  fullRange: TimeRange;
  index: number;
  /**
   * True for the newest chunk of a relative range — the only one whose bucket is
   * still filling, so it should refetch rather than cache forever.
   */
  isTrailingLive: boolean;
}

export type ChunkQueryOptions<TResponse> = UseQueryOptions<
  ApiResponse<TResponse>,
  Error,
  TResponse
>;

const DEFAULT_RETRY = (failureCount: number, error: Error) =>
  error instanceof RequestError && error.status === 429 && failureCount < 3;

/**
 * Builds one `apiOptions`-shaped query per chunk, ready to spread into
 * `useQueries`. Following Sentry's convention, this is a plain function over
 * `apiOptions` (not a hook wrapping `useQueries`) so the caller owns the
 * `useQueries` call and can compose, inspect, or prefetch the queries.
 *
 * The caller supplies `buildChunkQuery`, which builds the request for one time
 * window (endpoint, params, pinning, per-chunk `staleTime`, enablement via
 * `skipToken`). Feed the result to `useQueries`, then hand its output to
 * `useChunkedTimeRangeResults` to merge.
 *
 * ---------------------------------------------------------------------------
 * BACKEND CONTRACT (EAP / Snuba) — verified July 2025. Read before you futz.
 * ---------------------------------------------------------------------------
 * This whole approach only works because of how the EAP backend behaves. If you
 * point `buildChunkQuery` at a different dataset/endpoint, re-verify these:
 *
 * 1. TIME ALIGNMENT. Snuba anchors buckets to the request's `start`
 *    (`start + k*granularity`), NOT the epoch. Chunk boundaries MUST therefore
 *    be epoch-aligned multiples of the interval, or adjacent chunks land on
 *    different bucket phases and duplicate/drop the seam. `computeTimeChunks`
 *    guarantees this; keep using it. The interval must be a backend-accepted
 *    granularity (`VALID_GRANULARITIES`).
 *
 * 2. CACHING. Snuba's result cache key is an MD5 of the formatted SQL, which
 *    embeds the literal start/end. There is NO server-side quantization or jitter
 *    of the time range (a `now` that moves by one second is a cache miss). So
 *    identical concrete windows are individually cacheable — which is exactly why
 *    `buildChunkQuery` can set `staleTime: Infinity` on immutable historical
 *    chunks, and why the trailing (live) chunk should ceil its end to the
 *    interval so its key stays stable within an interval window. Cross-reload
 *    reuse comes from react-query here (the backend TTL is short/dedup-grade),
 *    and stable keys serve both.
 *
 * 3. SAMPLING / DOWNSAMPLING. EAP picks a downsampling tier PER REQUEST from the
 *    query's time range + estimated row count (snuba
 *    `storage_routing/routing_strategies/outcomes_based.py`). Different-sized
 *    chunks (and any full-range pre-query) can land on DIFFERENT tiers, at which
 *    point extrapolated `count()`s are noisy/non-uniform across chunks and exact
 *    aggregates like `min`/`max` are biased. If a consumer pins a domain/threshold
 *    from one query and then fetches data in chunks, force a uniform tier
 *    (`sampling: HIGHEST_ACCURACY`) on all of them, or accept the inconsistency.
 *    See `metricHeatmapBoundsApiOptions` / `metricHeatmapApiOptions` for a worked
 *    example (bounds + chunks both pinned to TIER_1).
 */
export function getChunkedTimeRangeQueries<TResponse>({
  chunks,
  chunked,
  isRelative,
  fullRange,
  buildChunkQuery,
  retry = DEFAULT_RETRY,
}: ResolvedTimeChunks & {
  buildChunkQuery: (context: ChunkQueryContext) => ChunkQueryOptions<TResponse>;
  retry?: ChunkQueryOptions<TResponse>['retry'];
}): Array<ChunkQueryOptions<TResponse>> {
  return chunks.map((chunk, index) => ({
    ...buildChunkQuery({
      chunk,
      index,
      chunked,
      isTrailingLive: chunked && isRelative && index === 0,
      fullRange,
    }),
    retry,
  }));
}
