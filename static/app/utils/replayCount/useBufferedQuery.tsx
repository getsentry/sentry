import {useCallback, useRef, useState} from 'react';

import {ApiResult} from 'sentry/api';
import {ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type GenQueryKey<Aggregate> = (ids: ReadonlyArray<Aggregate>) => ApiQueryKey;
type Reducer<Data> = (data: Data, result: ApiResult<unknown>) => Data;

// interface Opts<Aggregate, Data> {
//   api: Client;
//   bufferWaitMs: number;
//   defaultData: Data;
//   genQueryKey: GenQueryKey<Aggregate>;
//   onChange: (data: Data) => void;
//   onError: (error: Error) => void;
//   queryClient: QueryClient;
//   reducer: Reducer<Data>;
// }

// class Buffer<Aggregate, Data> {
//   private api: Client;
//   private queryClient: QueryClient;
//   private genQueryKey: GenQueryKey<Aggregate>;
//   private reducer: Reducer<Data>;
//   private bufferWaitMs: number;
//   private onChange: (data: Data) => void;
//   private onError: (error: Error) => void;

//   public data: Data;

//   private buffered: Set<Aggregate> = new Set();
//   private inFlight: Set<Aggregate> = new Set();
//   private done: Set<Aggregate> = new Set();

//   private timer: null | NodeJS.Timeout = null;

//   constructor({
//     api,
//     queryClient,
//     genQueryKey,
//     reducer,
//     defaultData,
//     bufferWaitMs,
//     onChange,
//     onError,
//   }: Opts<Aggregate, Data>) {
//     this.api = api;
//     this.queryClient = queryClient;
//     this.genQueryKey = genQueryKey;
//     this.reducer = reducer;
//     this.data = defaultData;
//     this.bufferWaitMs = bufferWaitMs;
//     this.onChange = onChange;
//     this.onError = onError;
//   }

//   public buffer = (aggregates: ReadonlyArray<Aggregate>) => {
//     let needsTimer = false;
//     for (const aggregate of aggregates) {
//       if (!this.inFlight.has(aggregate) && !this.done.has(aggregate)) {
//         this.buffered.add(aggregate);
//         needsTimer = true;
//       }
//     }
//     if (needsTimer) {
//       this.setTimer();
//     }
//   };

//   private clearTimer() {
//     if (this.timer) {
//       clearTimeout(this.timer);
//       this.timer = null;
//     }
//   }

//   private setTimer() {
//     this.clearTimer();
//     this.timer = setTimeout(() => {
//       this.fetch();
//       this.clearTimer();
//     }, this.bufferWaitMs);
//   }

//   private async fetch() {
//     const aggregates = Array.from(this.buffered);

//     this.buffered.clear();
//     aggregates.forEach(id => this.inFlight.add(id));

//     try {
//       const result = await this.queryClient.fetchQuery({
//         queryKey: this.genQueryKey(aggregates),
//         queryFn: fetchDataQuery(this.api),
//       });

//       this.data = this.reducer(this.data, result);

//       aggregates.forEach(id => {
//         this.inFlight.delete(id);
//         this.done.add(id);
//       });

//       this.onChange(this.data);
//     } catch (error) {
//       aggregates.forEach(id => {
//         this.inFlight.delete(id);
//         this.buffered.add(id);
//       });
//       this.onError(error);
//     }
//   }
// }

const BUFFER_WAIT_MS = 10;

export default function useBufferedQuery<QueryKeyAggregate, Data>(
  genQueryKey: GenQueryKey<QueryKeyAggregate>,
  reducer: Reducer<Data>,
  defaultData: Data
) {
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
      // onError(error);
    }
  }, [api, data, genQueryKey, queryClient, reducer]);

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
