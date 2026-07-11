import {useMemo} from 'react';
import {useQueries} from '@tanstack/react-query';
import type {UseQueryOptions} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {
  computeTimeChunks,
  type TimeChunk,
  type TimeChunkPolicy,
} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {RequestError} from 'sentry/utils/requestError/requestError';

interface TimeRange {
  end: number;
  start: number;
}

export interface ResolvedTimeChunks {
  /**
   * True when the range was split into more than one chunk.
   */
  chunked: boolean;
  /**
   * The chunks, newest-first.
   */
  chunks: TimeChunk[];
  /**
   * The full aligned range spanned by every chunk (not just loaded ones).
   */
  fullRange: TimeRange;
  intervalMs: number;
  /**
   * True when the page filter is a relative period (so the newest chunk is the
   * live edge).
   */
  isRelative: boolean;
}

/**
 * Resolves a page-filter selection + interval into a stable set of epoch-aligned
 * chunks. The range is resolved to concrete timestamps once per filter/interval
 * change; epoch-snapping keeps the historical boundaries stable across renders,
 * so only the live edge moves.
 */
export function useTimeChunks({
  selection,
  interval,
  policy,
}: {
  selection: PageFilters;
  interval?: string | null;
  policy?: TimeChunkPolicy;
}): ResolvedTimeChunks {
  return useMemo(() => {
    const empty: ResolvedTimeChunks = {
      chunks: [],
      chunked: false,
      isRelative: false,
      fullRange: {start: 0, end: 0},
      intervalMs: 0,
    };
    if (!defined(interval)) {
      return empty;
    }
    const intervalMs = intervalToMilliseconds(interval);
    if (intervalMs <= 0) {
      return empty;
    }

    const normalized = normalizeDateTimeParams(selection.datetime);
    let start: number;
    let end: number;
    let isRelative: boolean;
    if (defined(normalized.start) && defined(normalized.end)) {
      // normalizeDateTimeParams emits UTC strings without a `Z`, so parse them
      // as UTC (not local) to get the correct epoch ms.
      start = moment.utc(normalized.start).valueOf();
      end = moment.utc(normalized.end).valueOf();
      isRelative = false;
    } else {
      end = Date.now();
      start = end - getDiffInMinutes(selection.datetime) * 60 * 1000;
      isRelative = true;
    }

    const chunks = computeTimeChunks({start, end, interval, policy});
    return {
      chunks,
      chunked: chunks.length > 1,
      isRelative,
      intervalMs,
      fullRange: {
        start: chunks.length ? Math.min(...chunks.map(c => c.start)) : 0,
        end: chunks.length ? Math.max(...chunks.map(c => c.end)) : 0,
      },
    };
    // Date.now() is intentionally captured once per filter/interval change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selection.datetime.start,
    selection.datetime.end,
    selection.datetime.period,
    selection.datetime.utc,
    interval,
    policy?.initialBuckets,
    policy?.growthFactor,
    policy?.maxChunks,
    policy?.minBucketsToChunk,
  ]);
}

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

export interface ChunkMergeContext extends ResolvedTimeChunks {}

type ChunkQueryOptions<TResponse> = UseQueryOptions<
  ApiResponse<TResponse>,
  Error,
  TResponse
>;

export interface ChunkedTimeRangeResult<TMerged> {
  /**
   * The merged result, present as soon as one chunk resolves. Undefined while
   * everything is still pending.
   */
  data: TMerged | undefined;
  /**
   * A fatal error — every chunk failed. Partial failures do not set this.
   */
  error: Error | null;
  /**
   * At least one chunk is still loading while others have resolved.
   */
  isFetchingMore: boolean;
  /**
   * A chunk failed but others succeeded.
   */
  isPartial: boolean;
  /**
   * Nothing to render yet and no fatal error.
   */
  isPending: boolean;
}

const DEFAULT_RETRY = (failureCount: number, error: Error) =>
  error instanceof RequestError && error.status === 429 && failureCount < 3;

/**
 * Fetches a time range as several parallel, streamed chunks and merges them.
 *
 * The caller owns the two variable pieces: `buildChunkQuery` builds the request
 * for one time window (endpoint, params, pinning, per-chunk `staleTime`,
 * enablement), and `merge` stitches the succeeded responses into the final shape.
 * This hook owns the orchestration: firing the queries, the streaming/partial
 * state, and re-merging only when a chunk's data changes.
 *
 * `merge` should be referentially stable (wrap it in `useCallback`) — it's a
 * dependency of the merge memo.
 */
export function useChunkedTimeRangeQuery<TResponse, TMerged>({
  chunks,
  chunked,
  isRelative,
  fullRange,
  intervalMs,
  buildChunkQuery,
  merge,
  retry = DEFAULT_RETRY,
}: ResolvedTimeChunks & {
  buildChunkQuery: (context: ChunkQueryContext) => ChunkQueryOptions<TResponse>;
  merge: (responses: TResponse[], context: ChunkMergeContext) => TMerged;
  retry?: ChunkQueryOptions<TResponse>['retry'];
}): ChunkedTimeRangeResult<TMerged> {
  const queries = useQueries({
    queries: chunks.map((chunk, index) => ({
      ...buildChunkQuery({
        chunk,
        index,
        chunked,
        isTrailingLive: chunked && isRelative && index === 0,
        fullRange,
      }),
      retry,
    })),
  });

  // Re-merge only when a chunk's data actually changes. The signature is a
  // stable primitive that captures every chunk's status + data revision.
  const chunkSignature = queries.map(q => `${q.status}:${q.dataUpdatedAt}`).join('|');

  const data = useMemo(() => {
    const succeeded = queries
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    if (succeeded.length === 0) {
      return;
    }
    return merge(succeeded, {chunks, chunked, isRelative, fullRange, intervalMs});
    // chunkSignature stands in for queries' data; see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkSignature, merge, chunks, chunked, isRelative, fullRange, intervalMs]);

  const succeededCount = queries.filter(q => q.isSuccess).length;
  const erroredCount = queries.filter(q => q.isError).length;
  const loadingCount = queries.filter(
    q => q.isPending && q.fetchStatus === 'fetching'
  ).length;

  const allErrored = queries.length > 0 && erroredCount === queries.length;
  const error = allErrored ? (queries.find(q => q.error)?.error ?? null) : null;

  return {
    data,
    error,
    isPartial: chunked && erroredCount > 0 && succeededCount > 0,
    isFetchingMore: chunked && succeededCount > 0 && loadingCount > 0,
    isPending: !data && !error,
  };
}
