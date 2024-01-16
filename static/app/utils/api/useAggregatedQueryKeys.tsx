import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import uniq from 'lodash/uniq';

import {ApiResult} from 'sentry/api';
import {defined} from 'sentry/utils';
import {ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const BUFFER_WAIT_MS = 20;

interface Props<AggregatableQueryKey, Data> {
  /**
   * The queryKey reducer
   *
   * Takes the buffered "aggregates" and outputs an ApiQueryKey
   *
   * The returned key must have a stable url in the first index of the returned
   * array. This is used as a cache id.
   */
  getQueryKey: (ids: ReadonlyArray<AggregatableQueryKey>) => ApiQueryKey;

  /**
   * Data reducer, to integrate new requests with the previous state
   */
  responseReducer: (
    prevState: undefined | Data,
    result: ApiResult,
    aggregates: ReadonlyArray<AggregatableQueryKey>
  ) => undefined | Data;

  /**
   * Maximun number of items to keep in the buffer before flushing
   *
   * Default: 50
   */
  bufferLimit?: number;

  /**
   * Optional callback, should an error happen while fetching or reducing the data
   */
  onError?: (error: Error) => void;
}

function isQueryKeyInList<AggregatableQueryKey>(queryList: AggregatableQueryKey[]) {
  return ({queryKey}) => queryList.includes(queryKey[3] as AggregatableQueryKey);
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
 * - This hook returns a method called `buffer(aggregates: Array<any>)` and the
 *   value `data`.
 * - You will implement the props `getQueryKey(aggregates: Array<any>)` which
 *   takes the unique list of `aggregates` that have been passed into `buffer()`.
 *   The returned queryKey must have a stable url as the first array item.
 * - After after `buffer()` has stopped being called for BUFFER_WAIT_MS, or if
 *   bufferLimit items are queued, then `getQueryKey()` function will be called.
 * - The new queryKey will be used to fetch some data.
 * - You will implement `responseReducer(prev: Data, result: ApiResult)` which
 *   combines `defaultData` with the data that was fetched with the queryKey.
 */
export default function useAggregatedQueryKeys<AggregatableQueryKey, Data>({
  getQueryKey,
  onError,
  responseReducer,
  bufferLimit = 50,
}: Props<AggregatableQueryKey, Data>) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  const key = getQueryKey([]).at(0);

  // The query keys that this instance cares about
  const prevQueryKeys = useRef<AggregatableQueryKey[]>([]);

  const readCache = useCallback(
    () =>
      cache
        .findAll({queryKey: [key]})
        .map(({queryKey}) => queryClient.getQueryData<ApiResult>(queryKey))
        .filter(defined)
        .reduce(
          (prevValue, val) => responseReducer(prevValue, val, prevQueryKeys.current),
          undefined as Data | undefined
        ),
    [cache, key, queryClient, responseReducer]
  );

  // The counts for each query key that this instance cares about
  const [data, setData] = useState<undefined | Data>(readCache);

  const timer = useRef<null | NodeJS.Timeout>(null);

  const fetchData = useCallback(async () => {
    const allQueuedQueries = cache.findAll({
      queryKey: ['aggregate', key, 'queued'],
    });

    const queuedQueriesBatch = allQueuedQueries.slice(0, bufferLimit);
    if (!queuedQueriesBatch.length) {
      return;
    }

    const queuedAggregatableBatch = queuedQueriesBatch.map(
      ({queryKey}) => queryKey[3] as AggregatableQueryKey
    );

    const isQueryKeyInBatch = isQueryKeyInList(queuedAggregatableBatch);

    try {
      queryClient.removeQueries({
        queryKey: ['aggregate', key, 'queued'],
        predicate: isQueryKeyInBatch,
      });
      queuedAggregatableBatch.forEach(queryKey => {
        queryClient.setQueryData(['aggregate', key, 'inFlight', queryKey], true);
      });

      const promise = queryClient.fetchQuery({
        queryKey: getQueryKey(queuedAggregatableBatch),
        queryFn: fetchDataQuery(api),
      });

      if (allQueuedQueries.length > queuedQueriesBatch.length) {
        fetchData();
      }

      // When the promise resolves, it will trigger the cache subscription to fire
      await promise;

      queryClient.removeQueries({
        queryKey: ['aggregate', key, 'inFlight'],
        predicate: isQueryKeyInBatch,
      });
      queuedAggregatableBatch.forEach(queryKey => {
        queryClient.setQueryData(['aggregate', key, 'done', queryKey], true);
      });
    } catch (error) {
      onError?.(error);
    }
  }, [api, bufferLimit, cache, getQueryKey, key, onError, queryClient]);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const setTimer = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      fetchData();
      clearTimer();
    }, BUFFER_WAIT_MS);
  }, [clearTimer, fetchData]);

  const buffer = useCallback(
    (aggregates: readonly AggregatableQueryKey[]) => {
      // Track AggregatableQueryKey that we care about in this hook instance
      const queryKeys = uniq([...prevQueryKeys.current, ...aggregates]);
      if (queryKeys.length === prevQueryKeys.current.length) {
        return;
      }
      prevQueryKeys.current = queryKeys;

      // Get queryKeys for any cached data related to these aggregates.
      const existingQueryKeys = cache
        .findAll({
          queryKey: ['aggregate', key],
          predicate: isQueryKeyInList(prevQueryKeys.current),
        })
        .map(({queryKey}) => queryKey[3] as AggregatableQueryKey);

      // Don't request aggregates multiple times.
      const newQueryKeys = queryKeys.filter(agg => !existingQueryKeys.includes(agg));

      // Cache sentinel data for the new cacheKeys
      newQueryKeys
        .map(agg => ['aggregate', key, 'queued', agg])
        .forEach(queryKey => queryClient.setQueryData(queryKey, true));

      if (newQueryKeys.length) {
        setData(readCache());
        // Grab anything in the queue, including the newQueryKeys
        const existingQueuedQueries = cache.findAll({
          queryKey: ['aggregate', key, 'queued'],
        });
        if (existingQueuedQueries.length >= bufferLimit) {
          clearTimer();
          fetchData();
        } else {
          setTimer();
        }
      }
    },
    [bufferLimit, cache, clearTimer, fetchData, key, queryClient, readCache, setTimer]
  );

  useEffect(() => {
    const unsubscribe = cache.subscribe(result => {
      if (result.type === 'updated' && result.query.queryKey.at(0) === key) {
        setData(readCache());
      }
    });
    return unsubscribe;
  }, [key, cache, queryClient, readCache]);

  return useMemo(() => ({buffer, data}), [buffer, data]);
}
