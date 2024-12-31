import {useCallback, useEffect, useRef, useState} from 'react';

import {defined} from 'sentry/utils';
import parseLinkHeader, {type ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {type ApiQueryKey, fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface Props {
  /**
   * Whether or not to start fetching when the hook is mounted
   */
  enabled: boolean;

  /**
   * Generate the queryKey to use, given the pagination params
   * If `undefined` is returned iteration will not continue
   */
  getQueryKey: (pagination: {
    cursor: string;
    per_page: number;
  }) => undefined | ApiQueryKey;

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

/**
 * A query hook that fetches multiple pages of data from the same endpoint, one-by-one.
 *
 * See also: `useFetchParallelPages()`
 *
 * `useFetchSequentialPages` is an iterator for fetch calls. It makes it possible
 * to fetch ALL data from an api endpoint.
 *
 * <WARNING>
 *   Using this hook might not be a good idea!
 *   Pagination is a good stratergy to limit the amount of data that a server
 *   needs to fetch at a given time, it also limits the amount of data that the
 *   browser needs to hold in memory. Loading all data with this hook could
 *   cause rate-limiting, memory exhaustion, slow rendering, and other problems.
 *
 *   Before implementing a sequential-fetch you should first think about
 *   building new api endpoints that return just the data you need (in a
 *   paginated way), or look at the feature design itself and make adjustments.
 * </WARNING>
 *
 * EXAMPLE: you want to make a request for all user's within a project...
 *   In the well-behaved case this might seem fine, but in the pathological
 *   case (in the extreme) there could be too many users to do this safely!
 * If there are 64 users in the project, but the max page-size is only 50, then
 * you can expect two calls to be made. The network waterfall would look like:
 *
 * | Request        | Waterfall           |
 * | -------------- | ------------------- |
 * | ?cursor=0:0:0  | ========            |
 * | ?cursor=0:50:0 |         ========    |
 * |                | ^       ^       ^   |
 * |                | t=0     t=1     t=2 |
 *
 * At t=0 the hook will return `data=Array(0)` because no records are fetched yet.
 * At t=1 the hook will return `data=Array(50)` and will has `isFetching=true`
 * Finally at t=2 all data will be fetched and combined: `data=Array(64)`
 */
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
    isFetching: enabled,
  });

  const fetch = useCallback(
    async function recursiveFetch() {
      let parsedHeader: ParsedHeader | undefined = {
        cursor: initialCursor ?? '0:0:0',
        href: '',
        results: true,
      };
      try {
        while (parsedHeader?.results) {
          const cursor = parsedHeader.cursor;
          const queryKey = getQueryKey({cursor, per_page: perPage});
          if (!queryKey) {
            break;
          }
          const [data, , resp] = await queryClient.fetchQuery({
            queryKey,
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
        responsePages.current.set(parsedHeader?.cursor!, {
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
          error: values.map(value => value.error).at(0),
          getLastResponseHeader: values.at(-1)?.getResponseHeader,
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

    setState(prev => ({
      ...prev,
      isFetching: true,
    }));

    fetch();
  }, [enabled, fetch]);

  return state;
}
