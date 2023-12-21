import {useCallback, useEffect, useRef, useState} from 'react';

import {defined} from 'sentry/utils';
import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
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
   * You must set the page size to be used.
   *
   * This will be passed back as an argument into getQueryKey
   */
  perPage: number;

  /**
   * The initial cursor to use when fetching.
   *
   * Default: `0:0:0`
   */
  initialCursor?: undefined | string;
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

export default function useFetchSequentialPages<Data>({
  enabled,
  getQueryKey,
  initialCursor,
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
    async function recursiveFetch() {
      let parsedHeader: ParsedHeader = {
        cursor: initialCursor ?? '0:0:0',
        href: '',
        results: true,
      };
      try {
        while (parsedHeader?.results) {
          const cursor = parsedHeader.cursor;
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

          const pageLinks = resp?.getResponseHeader('Link') ?? null;
          parsedHeader = parseLinkHeader(pageLinks)?.next;
        }
      } catch (error) {
        responsePages.current.set(parsedHeader.cursor, {
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
    },
    [api, initialCursor, getQueryKey, perPage, queryClient]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetch();
  }, [enabled, fetch]);

  return state;
}
