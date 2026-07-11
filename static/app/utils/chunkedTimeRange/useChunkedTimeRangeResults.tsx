import {useMemo} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';

import type {ResolvedTimeChunks} from 'sentry/utils/chunkedTimeRange/useTimeChunks';
import {defined} from 'sentry/utils/defined';

export interface ChunkMergeContext extends ResolvedTimeChunks {}

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

/**
 * Stitches the output of a chunked `useQueries` back into one result and derives
 * the streaming/partial state.
 *
 * This is deliberately a hook (not a plain function) so it can memoize the merge
 * — re-running it only when a chunk's data actually changes, rather than every
 * render. It does not build or fire any queries; the caller owns `useQueries`
 * (see `getChunkedTimeRangeQueries`).
 *
 * `merge` MUST be referentially stable (wrap it in `useCallback`) — it's a
 * dependency of the merge memo.
 */
export function useChunkedTimeRangeResults<TResponse, TMerged>({
  chunks,
  chunked,
  isRelative,
  fullRange,
  intervalMs,
  results,
  merge,
}: ResolvedTimeChunks & {
  merge: (responses: TResponse[], context: ChunkMergeContext) => TMerged;
  results: Array<UseQueryResult<TResponse>>;
}): ChunkedTimeRangeResult<TMerged> {
  // Re-merge only when a chunk's data actually changes. The signature is a
  // stable primitive that captures every chunk's status + data revision.
  const signature = results.map(q => `${q.status}:${q.dataUpdatedAt}`).join('|');

  const data = useMemo(() => {
    const succeeded = results
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    if (succeeded.length === 0) {
      return;
    }
    return merge(succeeded, {chunks, chunked, isRelative, fullRange, intervalMs});
    // `signature` stands in for `results`' data; see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, merge, chunks, chunked, isRelative, fullRange, intervalMs]);

  const succeededCount = results.filter(q => q.isSuccess).length;
  const erroredCount = results.filter(q => q.isError).length;
  const loadingCount = results.filter(
    q => q.isPending && q.fetchStatus === 'fetching'
  ).length;

  const allErrored = results.length > 0 && erroredCount === results.length;
  const error = allErrored ? (results.find(q => q.error)?.error ?? null) : null;

  return {
    data,
    error,
    isPartial: chunked && erroredCount > 0 && succeededCount > 0,
    isFetchingMore: chunked && succeededCount > 0 && loadingCount > 0,
    isPending: !data && !error,
  };
}
