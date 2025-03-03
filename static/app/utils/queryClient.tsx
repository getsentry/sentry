import type {
  QueryClient,
  QueryClientConfig,
  QueryFunctionContext,
  SetDataOptions,
  Updater,
  UseInfiniteQueryResult as _UseInfiniteQueryResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import {useInfiniteQuery, useQueries, useQuery} from '@tanstack/react-query';

import type {APIRequestMethod, ApiResult, Client, ResponseMeta} from 'sentry/api';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

// Overrides to the default react-query options.
// See https://tanstack.com/query/v4/docs/guides/important-defaults
export const DEFAULT_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
};

// XXX: We need to set persistInFlight to disable query cancellation on
//      unmount. The current implementation of our API client does not
//      reject on query cancellation, which causes React Query to never
//      update from the isLoading state. This matches the library default
//      as well [0].
//
//      This is slightly different from our typical usage of our api client
//      in components, where we do not want it to resolve, since we would
//      then have to guard our setState's against being unmounted.
//
//      This has the advantage of storing the result in the cache as well.
//
//      [0]: https://tanstack.com/query/v4/docs/guides/query-cancellation#default-behavior
const PERSIST_IN_FLIGHT = true;

export type QueryKeyEndpointOptions<
  Headers = Record<string, string>,
  Query = Record<string, any>,
  Data = Record<string, any>,
> = {
  data?: Data;
  headers?: Headers;
  host?: string;
  method?: APIRequestMethod;
  query?: Query;
};

export type ApiQueryKey =
  | readonly [url: string]
  | readonly [
      url: string,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];

export interface UseApiQueryOptions<TApiResponse, TError = RequestError>
  extends Omit<
    UseQueryOptions<
      ApiResult<TApiResponse>,
      TError,
      ApiResult<TApiResponse>,
      ApiQueryKey
    >,
    // This is an explicit option in our function
    | 'queryKey'
    // This will always be a useApi api Query
    | 'queryFn'
    // We do not include the select option as this is difficult to make interop
    // with the way we extract data out of the ApiResult tuple
    | 'select'
  > {
  /**
   * staleTime is the amount of time (in ms) before cached data gets marked as stale.
   * Once data is marked stale, it will be refreshed on the next refetch event, which by default is when:
   * - The hook is mounted (configure with `refetchOnMount` option)
   * - The window is refocused (configure with `refetchOnWindowFocus` option)
   *
   * Use `staleTime: 0` if you need your data to always be up to date and don't mind excess refetches.
   * Be careful with this, especially if your hook is used at the root level or in multiple components.
   *
   * Use `staleTime: Infinity` if the data should never change, or changes very irregularly.
   * Note that the cached entries are garbage collected after 5 minutes of being unused (configure with `cacheTime`).
   *
   * Otherwise, provide a reasonable number (in ms) for your use case. Remember that the cache
   * can be updated or invalidated manually with QueryClient if you neeed to do so.
   */
  staleTime: number;
}

export type UseApiQueryResult<TData, TError> = UseQueryResult<TData, TError> & {
  /**
   * Get a header value from the response
   */
  getResponseHeader?: ResponseMeta['getResponseHeader'];
};

/**
 * Wraps React Query's useQuery for consistent usage in the Sentry app.
 * Query keys should be an array which include an endpoint URL and options such as query params.
 * This wrapper will execute the request using the query key URL.
 *
 * See https://tanstack.com/query/v4/docs/overview for docs on React Query.
 *
 * Example usage:
 *
 * const {data, isLoading, isError} = useQuery<EventsResponse>(
 *   ['/events', {query: {limit: 50}}],
 *   {staleTime: 0}
 * );
 */
export function useApiQuery<TResponseData, TError = RequestError>(
  queryKey: ApiQueryKey,
  options: UseApiQueryOptions<TResponseData, TError>
): UseApiQueryResult<TResponseData, TError> {
  const api = useApi({persistInFlight: PERSIST_IN_FLIGHT});
  const queryFn = fetchDataQuery(api);

  const {data, ...rest} = useQuery({
    queryKey,
    queryFn,
    ...options,
  });

  const queryResult = {
    data: data?.[0],
    getResponseHeader: data?.[2]?.getResponseHeader,
    ...rest,
  };

  // XXX: We need to cast here because unwrapping `data` breaks the type returned by
  //      useQuery above. The react-query library's UseQueryResult is a union type and
  //      too complex to recreate here so casting the entire object is more appropriate.
  return queryResult as UseApiQueryResult<TResponseData, TError>;
}

export function useApiQueries<TResponseData, TError = RequestError>(
  queryKeys: ApiQueryKey[],
  options: UseApiQueryOptions<TResponseData, TError>
): Array<UseApiQueryResult<TResponseData, TError>> {
  const api = useApi({persistInFlight: PERSIST_IN_FLIGHT});
  const queryFn = fetchDataQuery(api);

  const results = useQueries({
    queries: queryKeys.map(queryKey => {
      return {
        queryKey,
        queryFn,
        ...options,
      };
    }),
  });

  return results.map(({data, ...rest}) => {
    const queryResult = {
      data: data?.[0],
      getResponseHeader: data?.[2]?.getResponseHeader,
      ...rest,
    };

    // XXX: We need to cast here because unwrapping `data` breaks the type returned by
    //      useQuery above. The react-query library's UseQueryResult is a union type and
    //      too complex to recreate here so casting the entire object is more appropriate.
    return queryResult as UseApiQueryResult<TResponseData, TError>;
  });
}

/**
 * This method, given an `api` will return a new method which can be used as a
 * default `queryFn` with `useApiQuery` or even the raw `useQuery` hook.
 *
 * This returned method, the `queryFn`, unwraps react-query's `QueryFunctionContext`
 * type into parts that will be passed into api.requestPromise
 *
 * See also: fetchInfiniteQuery & fetchMutation
 */
export function fetchDataQuery(api: Client) {
  return function fetchDataQueryImpl(context: QueryFunctionContext<ApiQueryKey>) {
    const [url, opts] = context.queryKey;

    return api.requestPromise(url, {
      includeAllArgs: true,
      host: opts?.host,
      method: opts?.method ?? 'GET',
      data: opts?.data,
      query: opts?.query,
      headers: opts?.headers,
    });
  };
}

/**
 * Wraps React Query's queryClient.getQueryData to return only the cached API
 * response data. This does not include the ApiResult type. For that you can
 * manually call queryClient.getQueryData.
 */
export function getApiQueryData<TResponseData>(
  queryClient: QueryClient,
  queryKey: ApiQueryKey
): TResponseData | undefined {
  return queryClient.getQueryData<ApiResult<TResponseData>>(queryKey)?.[0];
}

/**
 * Wraps React Query's queryClient.setQueryData to allow setting of API
 * response data without needing to provide a request object.
 */
export function setApiQueryData<TResponseData>(
  queryClient: QueryClient,
  queryKey: ApiQueryKey,
  updater: Updater<TResponseData, TResponseData>,
  options?: SetDataOptions
): TResponseData | undefined {
  const previous = queryClient.getQueryData<ApiResult<TResponseData>>(queryKey);

  const newData =
    typeof updater === 'function'
      ? (updater as (input?: TResponseData) => TResponseData)(previous?.[0])
      : updater;

  const [_prevdata, prevStatusText, prevResponse] = previous ?? [
    undefined,
    undefined,
    undefined,
  ];

  const newResponse: ApiResult<TResponseData> = [newData, prevStatusText, prevResponse];

  queryClient.setQueryData(queryKey, newResponse, options);

  return newResponse[0];
}

/**
 * This method, given an `api` will return a new method which can be used as a
 * default `queryFn` with `useInfiniteQuery` hook.
 *
 * This returned method, the `queryFn`, unwraps react-query's `QueryFunctionContext`
 * type into parts that will be passed into api.requestPromise including the next
 * page cursor.
 *
 * See also: fetchDataQuery & fetchMutation
 */
export function fetchInfiniteQuery<TResponseData>(api: Client) {
  return function fetchInfiniteQueryImpl({
    pageParam,
    queryKey,
  }: QueryFunctionContext<ApiQueryKey, undefined | ParsedHeader>): Promise<
    ApiResult<TResponseData>
  > {
    const [url, endpointOptions] = queryKey;
    return api.requestPromise(url, {
      includeAllArgs: true,
      headers: endpointOptions?.headers,
      query: {
        ...endpointOptions?.query,
        cursor: pageParam?.cursor,
      },
    });
  };
}

function parsePageParam(dir: 'previous' | 'next') {
  return ([, , resp]: ApiResult<unknown>) => {
    const parsed = parseLinkHeader(resp?.getResponseHeader('Link') ?? null);
    return parsed[dir]?.results ? parsed[dir] : null;
  };
}

/**
 * Wraps React Query's useInfiniteQuery for consistent usage in the Sentry app.
 * Query keys should be an array which include an endpoint URL and options such as query params.
 * This wrapper will execute the request using the query key URL.
 *
 * See https://tanstack.com/query/v4/docs/overview for docs on React Query.
 */
export function useInfiniteApiQuery<TResponseData>({
  queryKey,
  enabled,
  staleTime,
}: {
  queryKey: ApiQueryKey;
  enabled?: boolean;
  staleTime?: number;
}) {
  const api = useApi({persistInFlight: PERSIST_IN_FLIGHT});
  const query = useInfiniteQuery({
    queryKey,
    queryFn: fetchInfiniteQuery<TResponseData>(api),
    getPreviousPageParam: parsePageParam('previous'),
    getNextPageParam: parsePageParam('next'),
    initialPageParam: undefined,
    enabled: enabled ?? true,
    staleTime,
  });

  return query;
}

type ApiMutationVariables<
  Headers = Record<string, string>,
  Query = Record<string, any>,
  Data = Record<string, unknown>,
> =
  | ['PUT' | 'POST' | 'DELETE', string]
  | ['PUT' | 'POST' | 'DELETE', string, QueryKeyEndpointOptions<Headers, Query>]
  | ['PUT' | 'POST' | 'DELETE', string, QueryKeyEndpointOptions<Headers, Query>, Data];

/**
 * This method, given an `api` will return a new method which can be used as a
 * default `queryFn` with `useMutation` hook.
 *
 * This returned method, the `queryFn`, unwraps react-query's `QueryFunctionContext`
 * type into parts that will be passed into api.requestPromise including different
 * `method` and supports putting & posting `data.
 *
 * See also: fetchDataQuery & fetchInfiniteQuery
 */
export function fetchMutation(api: Client) {
  return function fetchMutationImpl(variables: ApiMutationVariables) {
    const [method, url, opts, data] = variables;

    return api.requestPromise(url, {
      method,
      query: opts?.query,
      headers: opts?.headers,
      data,
    });
  };
}

export * from '@tanstack/react-query';
