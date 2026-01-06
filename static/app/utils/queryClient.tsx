import type {
  QueryClient,
  QueryClientConfig,
  QueryFunctionContext,
  SetDataOptions,
  Updater,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import {useInfiniteQuery, useQueries, useQuery} from '@tanstack/react-query';

import type {APIRequestMethod, ApiResult, ResponseMeta} from 'sentry/api';
import {Client} from 'sentry/api';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type RequestError from 'sentry/utils/requestError/requestError';

// Overrides to the default react-query options.
// See https://tanstack.com/query/v4/docs/guides/important-defaults
export const DEFAULT_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
};

const QUERY_API_CLIENT = new Client();

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
export type InfiniteApiQueryKey =
  | readonly ['infinite', url: string]
  | readonly [
      'infinite',
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

function isInfiniteQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): queryKey is InfiniteApiQueryKey {
  return queryKey[0] === 'infinite';
}

export function parseQueryKey(queryKey: undefined | ApiQueryKey | InfiniteApiQueryKey) {
  if (!queryKey) {
    return {isInfinite: false, url: undefined, options: undefined};
  }

  if (isInfiniteQueryKey(queryKey)) {
    return {
      isInfinite: true,
      url: queryKey[1],
      options: queryKey[2],
    };
  }
  return {
    isInfinite: false,
    url: queryKey[0],
    options: queryKey[1],
  };
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
 * See https://tanstack.com/query/v5/docs/framework/react/overview for docs on React Query.
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
  // eslint-disable-next-line @tanstack/query/no-rest-destructuring
  const {data, ...rest} = useQuery({
    queryKey,
    queryFn: fetchDataQuery<TResponseData>,
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
  const results = useQueries({
    queries: queryKeys.map(queryKey => {
      return {
        queryKey,
        queryFn: fetchDataQuery<TResponseData>,
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
 * This method can be used as a default `queryFn` with `useApiQuery`
 * or even the raw `useQuery` hook.
 *
 * See also: fetchMutation
 */
export function fetchDataQuery<TResponseData = unknown>(
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResult<TResponseData>> {
  const [url, opts] = context.queryKey;

  return QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    host: opts?.host,
    method: opts?.method ?? 'GET',
    data: opts?.data,
    query: opts?.query,
    headers: opts?.headers,
    signal: context.signal,
  });
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
  updater: Updater<TResponseData | undefined, TResponseData | undefined>,
  options?: SetDataOptions
): TResponseData | undefined {
  const updateResult = queryClient.setQueryData<ApiResult<TResponseData>>(
    queryKey,
    previous => {
      const [prevData, prevStatusText, prevResponse] = previous ?? [
        undefined,
        undefined,
        undefined,
      ];
      const newData =
        typeof updater === 'function'
          ? (updater as (input?: TResponseData) => TResponseData | undefined)(prevData)
          : updater;

      if (newData === undefined) {
        return previous;
      }
      return [newData, prevStatusText, prevResponse];
    },
    options
  );

  return updateResult?.[0];
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
  queryKey: InfiniteApiQueryKey;
  enabled?: boolean;
  staleTime?: number;
}) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({
      pageParam,
      queryKey: [, url, endpointOptions],
    }): Promise<ApiResult<TResponseData>> => {
      return QUERY_API_CLIENT.requestPromise(url, {
        includeAllArgs: true,
        headers: endpointOptions?.headers,
        query: {
          ...endpointOptions?.query,
          cursor: pageParam?.cursor,
        },
      });
    },
    getPreviousPageParam: parsePageParam('previous'),
    getNextPageParam: parsePageParam('next'),
    initialPageParam: undefined,
    enabled: enabled ?? true,
    staleTime,
  });
}

type ApiMutationVariables<
  Headers extends Record<string, unknown> = Record<string, string>,
  Query extends Record<string, unknown> = Record<string, any>,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = {
  method: 'PUT' | 'POST' | 'DELETE';
  url: string;
  data?: Data;
  options?: Pick<QueryKeyEndpointOptions<Headers, Query>, 'query' | 'headers' | 'host'>;
};

/**
 * This method can be used as a default `mutationFn` with `useMutation` hook.
 *
 * See also: fetchDataQuery
 */
export function fetchMutation<TResponseData = unknown>(
  variables: ApiMutationVariables
): Promise<TResponseData> {
  const {method, url, options, data} = variables;

  return QUERY_API_CLIENT.requestPromise(url, {
    method,
    query: options?.query,
    headers: options?.headers,
    host: options?.host,
    data,
  });
}

export * from '@tanstack/react-query';
