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
  const timer = useRef<NodeJS.Timeout>(null);

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
      // @ts-expect-error: Cannot assign to current because it is a read-only property.
      timer.current = null;
    }
  }, []);

  const setTimer = useCallback(() => {
    clearTimer();
    // @ts-expect-error: Cannot assign to current because it is a read-only property.
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
