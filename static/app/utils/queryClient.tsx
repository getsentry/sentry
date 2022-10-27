import * as reactQuery from '@tanstack/react-query';
import {QueryClientConfig} from '@tanstack/react-query';

import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type QueryKeyEndpointOptions = {
  query?: Record<string, any>;
};

type QueryKey =
  | readonly [url: string]
  | readonly [url: string, options: QueryKeyEndpointOptions];

type UseQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> = Omit<
  reactQuery.UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'queryKey' | 'queryFn'
>;

// We are not overriding any defaults options for stale time, retries, etc.
// See https://tanstack.com/query/v4/docs/guides/important-defaults
const DEFAULT_QUERY_CLIENT_CONFIG: QueryClientConfig = {};

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
 * const { data, isLoading, isError } = useQuery<EventsResponse>(['/events', { query: { limit: 50 }}])
 */
function useQuery<TQueryFnData, TError = RequestError, TData = TQueryFnData>(
  queryKey: QueryKey,
  queryFnOrQueryOptions?:
    | reactQuery.QueryFunction<TQueryFnData, QueryKey>
    | UseQueryOptions<TQueryFnData, TError, TData, QueryKey>,
  queryOptions?: UseQueryOptions<TQueryFnData, TError, TData, QueryKey>
) {
  const api = useApi();

  const [path, endpointOptions] = queryKey;

  const defaultQueryFn: reactQuery.QueryFunction<TQueryFnData, QueryKey> = () =>
    api.requestPromise(path, {
      method: 'GET',
      query: endpointOptions?.query,
    });

  const queryFn =
    typeof queryFnOrQueryOptions === 'function' ? queryFnOrQueryOptions : defaultQueryFn;

  return reactQuery.useQuery(queryKey, queryFn, queryOptions);
}

// eslint-disable-next-line import/export
export * from '@tanstack/react-query';

// eslint-disable-next-line import/export
export {DEFAULT_QUERY_CLIENT_CONFIG, useQuery};
