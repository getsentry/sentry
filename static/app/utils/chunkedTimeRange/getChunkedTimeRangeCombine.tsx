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
 * Builds the `combine` function for `useQueries({queries, combine})`: it stitches
 * the succeeded chunk responses via `merge` and derives the streaming/partial
 * state.
 *
 * We lean on TanStack's own memoization rather than rolling our own: query-core
 * re-runs `combine` only when the results actually change (or the `combine`
 * reference changes) and `replaceEqualDeep`s the output, so the merged grid is
 * rebuilt only on chunk transitions and stays referentially stable otherwise.
 *
 * BECAUSE of that, the returned function MUST be kept referentially stable — wrap
 * this call in `useMemo` keyed on the resolved chunks + `merge`. query-core keys
 * its memoization on the `combine` reference (`combine !== lastCombine`), so an
 * inline/unstable combine recomputes the (expensive) merge every render.
 */
export function getChunkedTimeRangeCombine<TResponse, TMerged>({
  chunks,
  isRelative,
  fullRange,
  intervalMs,
  merge,
}: ResolvedTimeChunks & {
  merge: (responses: TResponse[], context: ChunkMergeContext) => TMerged;
}): (results: Array<UseQueryResult<TResponse>>) => ChunkedTimeRangeResult<TMerged> {
  const chunked = chunks.length > 1;
  return results => {
    const succeeded = results
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    const succeededCount = results.filter(q => q.isSuccess).length;
    const erroredCount = results.filter(q => q.isError).length;
    const loadingCount = results.filter(
      q => q.isPending && q.fetchStatus === 'fetching'
    ).length;

    const allErrored = results.length > 0 && erroredCount === results.length;
    const error = allErrored ? (results.find(q => q.error)?.error ?? null) : null;

    const data =
      succeeded.length === 0
        ? undefined
        : merge(succeeded, {chunks, isRelative, fullRange, intervalMs});

    return {
      data,
      error,
      isPartial: chunked && erroredCount > 0 && succeededCount > 0,
      isFetchingMore: chunked && succeededCount > 0 && loadingCount > 0,
      isPending: !data && !error,
    };
  };
}
