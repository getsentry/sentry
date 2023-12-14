import {useCallback, useRef, useState} from 'react';
import first from 'lodash/first';

import {ApiResult} from 'sentry/api';
import {defined} from 'sentry/utils';
import {ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const BUFFER_WAIT_MS = 20;

interface Props<QueryKeyAggregate, Data> {
  /**
   * The queryKey reducer
   *
   * Takes the buffered "aggregates" and outputs an ApiQueryKey
   *
   * The returned key must have a stable url in the first index of the returned
   * array. This is used as a cache id.
   */
  getQueryKey: (ids: ReadonlyArray<QueryKeyAggregate>) => ApiQueryKey;

  /**
   * Data reducer, to integrate new requests with the previous state
   */
  responseReducer: (prev: undefined | Data, result: ApiResult<unknown>) => Data;

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
export default function useAggregatedQueryKeys<QueryKeyAggregate, Data>({
  getQueryKey,
  onError,
  responseReducer,
  bufferLimit = 50,
}: Props<QueryKeyAggregate, Data>) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  const key = first(getQueryKey([]));

  const [data, setData] = useState<undefined | Data>(() =>
    cache
      .findAll({queryKey: [key]})
      .map(({queryKey}) => queryClient.getQueryData<ApiResult>(queryKey))
      .filter(defined)
      .reduce(responseReducer, undefined)
  );

  const timer = useRef<null | NodeJS.Timeout>(null);

  const fetchData = useCallback(async () => {
    const allQueuedQueries = cache.findAll({
      queryKey: ['aggregate', key, 'queued'],
    });

    const selectedQueuedQueries = allQueuedQueries.slice(0, bufferLimit);
    if (!selectedQueuedQueries.length) {
      return;
    }

    const queuedAggregates = selectedQueuedQueries.map(
      ({queryKey}) => queryKey[3] as QueryKeyAggregate
    );

    try {
      queryClient.removeQueries({
        queryKey: ['aggregate', key, 'queued'],
        predicate: ({queryKey}) =>
          queuedAggregates.includes(queryKey[3] as QueryKeyAggregate),
      });
      selectedQueuedQueries.forEach(({queryKey}) => {
        const inFlightQueryKey = ['aggregate', key, 'inFlight', queryKey[3]];
        queryClient.setQueryData(inFlightQueryKey, true);
      });

      const promise = queryClient.fetchQuery({
        queryKey: getQueryKey(queuedAggregates),
        queryFn: fetchDataQuery(api),
      });

      if (allQueuedQueries.length > selectedQueuedQueries.length) {
        fetchData();
      }

      setData(responseReducer(data, await promise));

      queryClient.removeQueries({
        queryKey: ['aggregate', key, 'inFlight'],
        predicate: ({queryKey}) =>
          queuedAggregates.includes(queryKey[3] as QueryKeyAggregate),
      });
      selectedQueuedQueries.forEach(({queryKey}) => {
        const doneQueryKey = ['aggregate', key, 'done', queryKey[3]];
        queryClient.setQueryData(doneQueryKey, true);
      });
    } catch (error) {
      onError?.(error);
    }
  }, [
    api,
    bufferLimit,
    cache,
    data,
    getQueryKey,
    key,
    onError,
    queryClient,
    responseReducer,
  ]);

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
    (aggregates: ReadonlyArray<QueryKeyAggregate>) => {
      const foundQueries = cache.findAll({
        queryKey: ['aggregate', key],
        predicate: ({queryKey}) => aggregates.includes(queryKey[3] as QueryKeyAggregate),
      });
      const foundAggregates = foundQueries.map(({queryKey}) => queryKey[3]);

      const newCacheKeys = aggregates
        .filter(aggregate => !foundAggregates.includes(aggregate))
        .map(aggregate => ['aggregate', key, 'queued', aggregate])
        .map(queryKey => queryClient.setQueryData(queryKey, true));

      if (newCacheKeys.length) {
        if (foundQueries.length + newCacheKeys.length >= bufferLimit) {
          clearTimer();
          fetchData();
        } else {
          setTimer();
        }
      }
    },
    [bufferLimit, cache, clearTimer, fetchData, key, queryClient, setTimer]
  );

  return {data, buffer};
}
