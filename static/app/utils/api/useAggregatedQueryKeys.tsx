import {useCallback, useRef, useState} from 'react';

import {ApiResult} from 'sentry/api';
import {ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const BUFFER_WAIT_MS = 20;

interface Props<QueryKeyAggregate, Data> {
  /**
   * Default data that goes into `useState`
   */
  defaultData: Data;

  /**
   * The queryKey reducer/generator.
   *
   * Takes the buffered "aggregates" and outputs an ApiQueryKey
   */
  genQueryKey: (ids: ReadonlyArray<QueryKeyAggregate>) => ApiQueryKey;

  /**
   * Data reducer, to integrate new requests with the previous state
   */
  reducer: (prev: Data, result: ApiResult<unknown>) => Data;

  /**
   * Callback should an error happen while fetching or reducing the data
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
 * - The hook returns a method called `buffer(aggregates: Array<any>)` and the
 *   value `data`.
 * - You will implement the props `getQueryKey(aggregates: Array<any>)` which
 *   takes the unique list of `aggregates` that have been passed into `buffer()`.
 *   Your `getQueryKey()` function will be invoked after `buffer()` has stopped
 *   being called for BUFFER_WAIT_MS, this is a debounce mechanic.
 * - The new queryKey will be used to fetch some data
 * - You will implement `reducer(prev: Data, result: ApiResult)` which combines
 *   `defaultData` with the data that was fetched with the queryKey.
 */
export default function useAggregatedQueryKeys<QueryKeyAggregate, Data>({
  defaultData,
  genQueryKey,
  reducer,
  onError,
}: Props<QueryKeyAggregate, Data>) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const buffered = useRef<Set<QueryKeyAggregate>>(new Set());
  const inFlight = useRef<Set<QueryKeyAggregate>>(new Set());
  const done = useRef<Set<QueryKeyAggregate>>(new Set());
  const timer = useRef<null | NodeJS.Timeout>(null);

  const [data, setData] = useState<Data>(defaultData);

  const fetchData = useCallback(async () => {
    const aggregates = Array.from(buffered.current);

    buffered.current.clear();
    aggregates.forEach(id => inFlight.current.add(id));

    try {
      const result = await queryClient.fetchQuery({
        queryKey: genQueryKey(aggregates),
        queryFn: fetchDataQuery(api),
      });

      setData(reducer(data, result));

      aggregates.forEach(id => {
        inFlight.current.delete(id);
        done.current.add(id);
      });
    } catch (error) {
      aggregates.forEach(id => {
        inFlight.current.delete(id);
        buffered.current.add(id);
      });
      onError?.(error);
    }
  }, [api, data, genQueryKey, queryClient, reducer, onError]);

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
      let needsTimer = false;
      for (const aggregate of aggregates) {
        if (
          !buffered.current.has(aggregate) &&
          !inFlight.current.has(aggregate) &&
          !done.current.has(aggregate)
        ) {
          buffered.current.add(aggregate);
          needsTimer = true;
        }
      }
      if (needsTimer) {
        setTimer();
      }
    },
    [setTimer]
  );

  return {data, buffer};
}
