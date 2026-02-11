import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {defined} from 'sentry/utils';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

interface Props {
  /**
   * Whether or not to start fetched when the hook is mounted
   */
  enabled: boolean;

  /**
   * Generate the queryKey to use, given the pagination params
   */
  getQueryKey: (pagination: {cursor: string; per_page: number}) => ApiQueryKey;

  /**
   * The total number of records within the dataset
   *
   * This, combined with `perPage`, determines the number of fetches to make
   */
  hits: number;
  /**
   * The size of each page to fetch
   *
   * This, combined with `hits`, determines the number of fetches to make
   */
  perPage: number;
}

interface ResponsePage<Data> {
  data: undefined | Data;
  error: RequestError | undefined;
  getResponseHeader: ((header: string) => string | null) | undefined;
  isError: boolean;
  isFetching: boolean;
  status: 'pending' | 'error' | 'success';
}

interface State<Data> {
  error: RequestError[] | undefined;
  getLastResponseHeader: ((header: string) => string | null) | undefined;
  isError: boolean;
  isFetching: boolean;
  pages: Data[];
  status: 'pending' | 'error' | 'success';
}

/**
 * A query hook to fetch a fixed number of list pages all at once.
 *
 * See also: `useFetchSequentialPages()`
 *
 * <WARNING>
 *   Using this hook might not be a good idea!
 *   Pagination is a good strategy to limit the amount of data that a server
 *   needs to fetch at a given time, it also limits the amount of data that the
 *   browser needs to hold in memory. Loading all data with this hook could
 *   cause rate-limiting, memory exhaustion, slow rendering, and other problems.
 *
 *   Before implementing a parallel-fetch you should first think about
 *   building new api endpoints that return just the data you need (in a
 *   paginated way), or look at the feature design itself and make adjustments.
 * </WARNING>
 *
 * EXAMPLE: You want to fetch 100 items to show in a list, but the max-page-size
 * is set to only 50.
 *   In the well-behaved case this might seem fine, but in the pathological
 *   case (in the extreme) there could be too many users to do this safely!
 * Knowing that you have to make
 *
 * | Request        | Waterfall     |
 * | -------------- | ------------- |
 * | ?cursor=0:0:0  | ==========    |
 * | ?cursor=0:50:0 | =======       |
 * |                | ^      ^  ^   |
 * |                | t=0    t=1    |
 * |                |           t=2 |
 *
 * At t=0 the hook will return `data=Array(0)` because no records are fetched yet.
 * - Both requests will start at the same time, but are not guaranteed to end at
 *   the same time, or in order.
 * - If the network saturated with many requests (which can happen during
 *   pageload) then some requests might still need to wait before starting.
 * - Each response (in this case 2) will cause a re-render.
 * - Responses will return out of order (in this case items 50 to 100 return
 *   before items 0 to 50) which could cause layout shift.
 */
export default function useFetchParallelPages<Data>({
  enabled,
  hits,
  getQueryKey,
  perPage,
}: Props): State<Data> {
  const queryClient = useQueryClient();

  const responsePages = useRef<Map<string, ResponsePage<Data>>>(new Map());

  const cursors = useMemo(
    () =>
      new Array(Math.ceil(hits / perPage)).fill(0).map((_, i) => `0:${perPage * i}:0`),
    [hits, perPage]
  );

  const [state, setState] = useState<State<Data>>({
    pages: [],
    error: undefined,
    getLastResponseHeader: undefined,
    status: enabled ? (cursors.length ? 'pending' : 'success') : 'pending',
    isError: false,
    isFetching: enabled && Boolean(cursors.length),
  });

  const fetch = useCallback(async () => {
    await Promise.allSettled(
      cursors.map(async cursor => {
        try {
          responsePages.current.set(cursor, {
            data: undefined,
            error: undefined,
            getResponseHeader: undefined,
            status: 'pending',
            isError: false,
            isFetching: true,
          });

          const [data, , resp] = await queryClient.fetchQuery({
            queryKey: getQueryKey({cursor, per_page: perPage}),
            queryFn: fetchDataQuery<Data>,
            staleTime: Infinity,
          });

          responsePages.current.set(cursor, {
            data,
            error: undefined,
            getResponseHeader: resp?.getResponseHeader,
            status: 'success',
            isError: false,
            isFetching: false,
          });
        } catch (error) {
          responsePages.current.set(cursor, {
            data: undefined,
            error: error as RequestError,
            getResponseHeader: undefined,
            status: 'error',
            isError: true,
            isFetching: false,
          });
        } finally {
          const values = Array.from(responsePages.current.values());
          setState({
            pages: values.map(value => value.data).filter(defined),
            error: values.map(value => value.error).filter(defined),
            getLastResponseHeader: values.slice(-1)[0]?.getResponseHeader,
            status: values.some(value => value.status === 'error')
              ? 'error'
              : values.some(value => value.status === 'pending')
                ? 'pending'
                : 'success',
            isError: values.map(value => value.isError).some(Boolean),
            isFetching: values.map(value => value.isFetching).some(Boolean),
          });
        }
      })
    );
  }, [cursors, getQueryKey, perPage, queryClient]);

  useEffect(() => {
    if (enabled) {
      if (cursors.length) {
        setState(prev => ({...prev, status: 'pending', isFetching: true}));
        fetch();
      } else {
        setState(prev => ({...prev, status: 'success', isFetching: false}));
      }
    } else {
      setState(prev => ({...prev, status: 'pending', isFetching: false}));
    }
  }, [cursors, enabled, fetch]);

  return state;
}
