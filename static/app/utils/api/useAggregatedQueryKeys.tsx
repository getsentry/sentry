import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQueryClient, type Query, type UseQueryOptions} from '@tanstack/react-query';

import {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {
  type ApiQueryKey,
  parseQueryKey,
  safeParseQueryKey,
} from 'sentry/utils/api/apiQueryKey';
import {uniq} from 'sentry/utils/array/uniq';
import {defined} from 'sentry/utils/defined';

const BUFFER_WAIT_MS = 20;

interface Props<AggregatableQueryKey, Data, ResponseData = Data> {
  /**
   * The queryKey reducer
   *
   * Takes the buffered "aggregates" and outputs queryOptions.
   * Must not have side-effects.
   */
  getQueryOptions: (
    ids: readonly AggregatableQueryKey[]
  ) => UseQueryOptions<ApiResponse<ResponseData>, Error, ResponseData, ApiQueryKey>;

  /**
   * Data reducer, to integrate new requests with the previous state
   */
  responseReducer: (
    prevState: undefined | Data,
    result: ApiResponse<ResponseData>,
    aggregates: readonly AggregatableQueryKey[]
  ) => undefined | Data;

  /**
   * Maximum number of items to keep in the buffer before flushing
   *
   * Default: 50
   */
  bufferLimit?: number;

  /**
   * Optional key for caching requested and in-flight aggregates.
   * Cache keys should be unique across every useAggregatedQueryKeys callsite.
   *
   * Callsites without a cacheKey share their queue with every other
   * keyless callsite for the same url.
   */
  cacheKey?: string;

  /**
   * Optional callback, should an error happen while fetching or reducing the data
   */
  onError?: (error: Error) => void;

  /** Restrict which query keys can contribute cached responses. */
  queryFilter?: (queryKey: readonly unknown[]) => boolean;
}

/**
 * Sentinel entries are keyed `['aggregate', cacheKey, url, status, aggregate]`
 */
function getAggregate(query: Query): unknown {
  return query.queryKey[4];
}

function isAggregateInList(list: readonly unknown[]) {
  return (query: Query) => list.includes(getAggregate(query));
}

/**
 * A reducer function for similar query calls.
 *
 * `useAggregatedQueryKeys` is a reducer for query calls. Instead of individually
 * fetching a handful of records; you can batch the requests by emitting a new
 * queryKey.
 *
 * EXAMPLE: parallel request like: `GET /api/item/?id=1` & `GET /api/item/?id=2`
 * would be reduced into a single request `GET /api/item/id=[1,2]`
 *
 * This works well with our search endpoints, which have support for querying
 * multiple ids.
 *
 * How it works:
 * - This hook returns a method called `buffer(aggregates: Array<any>)`, the
 *   value `data`, and `read(aggregates: Array<any>)` to read the cache directly.
 * - You will implement the prop `getQueryOptions(aggregates: Array<any>)` which
 *   takes the unique list of `aggregates` that have been passed into `buffer()`.
 *   The returned queryKey must have a stable url.
 * - After `buffer()` has stopped being called for BUFFER_WAIT_MS, or if
 *   bufferLimit items are queued, then `getQueryOptions()` will be called.
 * - The new queryOptions will be used to fetch some data.
 * - You will implement `responseReducer(prev: Data, result: ApiResponse<Data>)` which
 *   folds every cached response for the url into one `data` value.
 */
export function useAggregatedQueryKeys<AggregatableQueryKey, Data, ResponseData = Data>({
  cacheKey,
  getQueryOptions,
  onError,
  queryFilter,
  responseReducer,
  bufferLimit = 50,
}: Props<AggregatableQueryKey, Data, ResponseData>) {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  const url = parseQueryKey(getQueryOptions([]).queryKey).url;

  // Sentinels live in the shared query cache, rather than in this hook, so
  // every instance can see what is already queued or in flight.
  const sentinelKey = useMemo(() => ['aggregate', cacheKey, url], [cacheKey, url]);
  const queuedKey = useMemo(() => [...sentinelKey, 'queued'], [sentinelKey]);
  const inFlightKey = useMemo(() => [...sentinelKey, 'inFlight'], [sentinelKey]);

  const isApiQueryKeyForUrl = useCallback(
    (queryKey: readonly unknown[]): boolean => {
      return (
        safeParseQueryKey(queryKey)?.url === url && (queryFilter?.(queryKey) ?? true)
      );
    },
    [queryFilter, url]
  );

  const readCache = useCallback(
    (aggregates: readonly AggregatableQueryKey[]) =>
      queryClient
        .getQueriesData<ApiResponse<ResponseData>>({
          predicate: ({queryKey}) => isApiQueryKeyForUrl(queryKey),
        })
        .flatMap(([, val]) => (defined(val) ? [val] : []))
        .reduce<Data | undefined>(
          (prevValue, val) => responseReducer(prevValue, val, aggregates),
          undefined
        ),
    [isApiQueryKeyForUrl, queryClient, responseReducer]
  );

  // The aggregates that this instance cares about
  const prevAggregates = useRef<AggregatableQueryKey[]>([]);

  const [data, setData] = useState(() => readCache([]));

  const timer = useRef<null | NodeJS.Timeout>(null);

  const fetchData = useCallback(() => {
    const queued = cache
      .findAll({queryKey: queuedKey})
      .map(query => getAggregate(query) as AggregatableQueryKey);

    for (let start = 0; start < queued.length; start += bufferLimit) {
      const batch = queued.slice(start, start + bufferLimit);
      const isInBatch = isAggregateInList(batch);

      try {
        queryClient.removeQueries({queryKey: queuedKey, predicate: isInBatch});
        batch.forEach(aggregate => {
          queryClient.setQueryData([...inFlightKey, aggregate], true);
        });

        queryClient.fetchQuery(getQueryOptions(batch)).finally(() => {
          queryClient.removeQueries({queryKey: inFlightKey, predicate: isInBatch});
        });
      } catch (error) {
        onError?.(error as Error);
        return;
      }
    }
  }, [bufferLimit, cache, getQueryOptions, inFlightKey, onError, queryClient, queuedKey]);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // The timer is not cleared on unmount: other instances may be waiting on
  // aggregates that only this instance queued.
  const setTimer = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      fetchData();
      clearTimer();
    }, BUFFER_WAIT_MS);
  }, [clearTimer, fetchData]);

  const buffer = useCallback(
    (aggregates: readonly AggregatableQueryKey[]) => {
      const allAggregates = uniq([...prevAggregates.current, ...aggregates]);
      if (allAggregates.length === prevAggregates.current.length) {
        return;
      }
      prevAggregates.current = allAggregates;

      // Don't request aggregates that are already queued or in flight.
      const trackedAggregates = cache
        .findAll({queryKey: sentinelKey, predicate: isAggregateInList(allAggregates)})
        .map(getAggregate);
      const newAggregates = allAggregates.filter(
        aggregate => !trackedAggregates.includes(aggregate)
      );
      if (!newAggregates.length) {
        return;
      }

      newAggregates.forEach(aggregate => {
        queryClient.setQueryData([...queuedKey, aggregate], true);
      });
      setData(readCache(allAggregates));

      if (cache.findAll({queryKey: queuedKey}).length >= bufferLimit) {
        clearTimer();
        fetchData();
      } else {
        setTimer();
      }
    },
    [
      bufferLimit,
      cache,
      clearTimer,
      fetchData,
      queryClient,
      queuedKey,
      readCache,
      sentinelKey,
      setTimer,
    ]
  );

  useEffect(() => {
    return cache.subscribe(result => {
      if (result.type === 'updated' && isApiQueryKeyForUrl(result.query.queryKey)) {
        setData(readCache(prevAggregates.current));
      }
    });
  }, [cache, isApiQueryKeyForUrl, readCache]);

  return useMemo(() => ({buffer, data, read: readCache}), [buffer, data, readCache]);
}
