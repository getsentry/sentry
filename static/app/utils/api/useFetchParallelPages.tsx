import {useCallback, useEffect, useRef, useState} from 'react';

import {defined} from 'sentry/utils';
import {ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

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
  error: unknown;
  getResponseHeader: ((header: string) => string | null) | undefined;
  isError: boolean;
  isFetching: boolean;
}

interface State<Data> {
  error: unknown;
  getLastResponseHeader: ((header: string) => string | null) | undefined;
  isError: boolean;
  isFetching: boolean;
  pages: Data[];
}

export default function useFetchParallelPages<Data>({
  enabled,
  hits,
  getQueryKey,
  perPage,
}: Props): State<Data> {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const responsePages = useRef<Map<string, ResponsePage<Data>>>(new Map());
  const [state, setState] = useState<State<Data>>({
    pages: [],
    error: undefined,
    getLastResponseHeader: undefined,
    isError: false,
    isFetching: true,
  });

  const fetch = useCallback(
    async function () {
      const pages = Math.ceil(hits / perPage);
      const cursors = new Array(pages).fill(0).map((_, i) => `0:${perPage * i}:0`);

      await Promise.allSettled(
        cursors.map(async cursor => {
          try {
            responsePages.current.set(cursor, {
              data: undefined,
              error: undefined,
              getResponseHeader: undefined,
              isError: false,
              isFetching: true,
            });

            const [data, , resp] = await queryClient.fetchQuery({
              queryKey: getQueryKey({cursor, per_page: perPage}),
              queryFn: fetchDataQuery(api),
              staleTime: Infinity,
            });

            responsePages.current.set(cursor, {
              data,
              error: undefined,
              getResponseHeader: resp?.getResponseHeader,
              isError: false,
              isFetching: false,
            });
          } catch (error) {
            responsePages.current.set(cursor, {
              data: undefined,
              error,
              getResponseHeader: undefined,
              isError: true,
              isFetching: false,
            });
          } finally {
            const values = Array.from(responsePages.current.values());
            setState({
              pages: values.map(value => value.data).filter(defined),
              error: values.map(value => value.error),
              getLastResponseHeader: values.slice(-1)[0]?.getResponseHeader,
              isError: values.map(value => value.isError).some(Boolean),
              isFetching: values.map(value => value.isFetching).every(Boolean),
            });
          }
        })
      );
    },
    [api, hits, getQueryKey, perPage, queryClient]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetch();
  }, [enabled, fetch]);

  return state;
}
