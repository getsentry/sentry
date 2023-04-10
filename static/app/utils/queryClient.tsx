import * as reactQuery from '@tanstack/react-query';
import {QueryClientConfig} from '@tanstack/react-query';

import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type QueryKeyEndpointOptions = {
  query?: Record<string, any>;
};

export type ApiQueryKey =
  | readonly [url: string]
  | readonly [url: string, options: QueryKeyEndpointOptions];

export interface UseApiQueryOptions<
  TQueryFnData,
  TError = RequestError,
  TData = TQueryFnData
> extends Omit<
    reactQuery.UseQueryOptions<TQueryFnData, TError, TData, ApiQueryKey>,
    'queryKey' | 'queryFn'
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

/**
 * TODO(epurkhiser): Remove once getsentry references are updated
 */
export interface UseQueryOptions<
  TQueryFnData,
  TError = RequestError,
  TData = TQueryFnData
> extends UseApiQueryOptions<TQueryFnData, TError, TData> {}

// Overrides to the default react-query options.
// See https://tanstack.com/query/v4/docs/guides/important-defaults
const DEFAULT_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
};

function isQueryFn<TQueryFnData, TError, TData>(
  queryFnOrQueryOptions?:
    | reactQuery.QueryFunction<TQueryFnData, ApiQueryKey>
    | UseApiQueryOptions<TQueryFnData, TError, TData>
): queryFnOrQueryOptions is reactQuery.QueryFunction<TQueryFnData, ApiQueryKey> {
  return typeof queryFnOrQueryOptions === 'function';
}

/**
 * Wraps React Query's useQuery for consistent usage in the Sentry app.
 * Query keys should be an array which include an endpoint URL and options such as query params.
 * This wrapper will execute the request using the query key URL, but if you need custom behavior
 * you may supply your own query function as the second argument.
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
function useApiQuery<TQueryFnData, TError = RequestError, TData = TQueryFnData>(
  queryKey: ApiQueryKey,
  queryOptions: UseApiQueryOptions<TQueryFnData, TError, TData>
): reactQuery.UseQueryResult<TData, TError>;
/**
 * Example usage with custom query function:
 *
 * const { data, isLoading, isError } = useQuery<EventsResponse>(
 *   ['events', {limit: 50}],
 *   () => api.requestPromise({limit: 50}),
 *   {staleTime: 0}
 * )
 */
function useApiQuery<TQueryFnData, TError = RequestError, TData = TQueryFnData>(
  queryKey: ApiQueryKey,
  queryFn: reactQuery.QueryFunction<TQueryFnData, ApiQueryKey>,
  queryOptions?: UseApiQueryOptions<TQueryFnData, TError, TData>
): reactQuery.UseQueryResult<TData, TError>;
function useApiQuery<TQueryFnData, TError = RequestError, TData = TQueryFnData>(
  queryKey: ApiQueryKey,
  queryFnOrQueryOptions:
    | reactQuery.QueryFunction<TQueryFnData, ApiQueryKey>
    | UseApiQueryOptions<TQueryFnData, TError, TData>,
  queryOptions?: UseApiQueryOptions<TQueryFnData, TError, TData>
): reactQuery.UseQueryResult<TData, TError> {
  // XXX: We need to set persistInFlight to disable query cancellation on unmount.
  // The current implementation of our API client does not reject on query
  // cancellation, which causes React Query to never update from the isLoading state.
  // This matches the library default as well: https://tanstack.com/query/v4/docs/guides/query-cancellation#default-behavior
  const api = useApi({persistInFlight: true});

  const [path, endpointOptions] = queryKey;

  const defaultQueryFn: reactQuery.QueryFunction<TQueryFnData, ApiQueryKey> = () =>
    api.requestPromise(path, {
      method: 'GET',
      query: endpointOptions?.query,
    });

  const queryFn = isQueryFn(queryFnOrQueryOptions)
    ? queryFnOrQueryOptions
    : defaultQueryFn;

  const options =
    queryOptions ??
    (isQueryFn(queryFnOrQueryOptions) ? undefined : queryFnOrQueryOptions);

  return reactQuery.useQuery(queryKey, queryFn, options);
}

// eslint-disable-next-line import/export
export * from '@tanstack/react-query';

// eslint-disable-next-line import/export
export {DEFAULT_QUERY_CLIENT_CONFIG, useApiQuery};
