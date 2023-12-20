import {useCallback, useEffect, useRef, useState} from 'react';

import {ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface State<Data> {
  data: Data[];
  error: unknown;
  isError: boolean;
  isFetching: boolean;
}

export default function useFetchReplayPaginatedData<Data>({
  enabled,
  hits,
  makeQueryKey,
  perPage,
}: {
  enabled: boolean;
  hits: number;
  makeQueryKey: (pagination: {cursor: string; per_page: number}) => ApiQueryKey;
  perPage: number;
}): State<Data> {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const responsePages = useRef<Map<string, State<Data>>>(new Map());
  const [state, setState] = useState<State<Data>>({
    data: [],
    error: undefined,
    isError: false,
    isFetching: true,
  });

  const fetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const pages = Math.ceil(hits / perPage);
    const cursors = new Array(pages).fill(0).map((_, i) => `0:${perPage * i}:0`);

    await Promise.allSettled(
      cursors.map(async cursor => {
        try {
          responsePages.current.set(cursor, {
            data: [],
            error: undefined,
            isError: false,
            isFetching: true,
          });

          const [data] = await queryClient.fetchQuery({
            queryKey: makeQueryKey({cursor, per_page: perPage}),
            queryFn: fetchDataQuery(api),
            staleTime: Infinity,
          });

          responsePages.current.set(cursor, {
            data,
            error: undefined,
            isError: false,
            isFetching: false,
          });
        } catch (error) {
          responsePages.current.set(cursor, {
            data: [],
            error,
            isError: true,
            isFetching: false,
          });
        } finally {
          const values = Array.from(responsePages.current.values());
          setState({
            data: values.flatMap(value => value.data),
            error: values.map(value => value.error),
            isError: values.map(value => value.isError).some(Boolean),
            isFetching: values.map(value => value.isFetching).every(Boolean),
          });
        }
      })
    );
  }, [api, enabled, hits, makeQueryKey, perPage, queryClient]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return state;
}
