import * as reactQuery from '@tanstack/react-query';
import {QueryClientConfig} from '@tanstack/react-query';

import {APIRequestMethod} from 'sentry/api';
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

interface UseMutationOptionsWithApiOptions<TData, TError, TVariables, TContext>
  extends Omit<
    reactQuery.UseMutationOptions<TData, TError, TVariables, TContext>,
    'mutationFn'
  > {
  api: {
    method: Exclude<APIRequestMethod, 'GET'>;
    url: string;
    data?: any;
    query?: Record<string, any>;
  };
  mutationFn?: never;
}

type UseMutationOptions<TData, TError, TVariables, TContext> =
  | reactQuery.UseMutationOptions<TData, TError, TVariables, TContext>
  | UseMutationOptionsWithApiOptions<TData, TError, TVariables, TContext>;

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

/**
 * Wraps React Query's useMutation for consistent usage in the Sentry app.
 *
 * Must provide either an api config object (preferred) or a custom mutation function.
 *
 * Example usage:
 *
 * const { mutate } = useMutation({ api: { url: /events, method: 'POST', data: { name: 'test' }}})
 */
function useMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
  const api = useApi();

  if ('api' in options) {
    return reactQuery.useMutation({
      ...options,
      mutationFn: () =>
        api.requestPromise(options.api.url, {
          method: options.api.method,
          data: options.api.data,
          query: options.api.query,
        }),
    });
  }

  return reactQuery.useMutation(options);
}

// eslint-disable-next-line import/export
export * from '@tanstack/react-query';

// eslint-disable-next-line import/export
export {DEFAULT_QUERY_CLIENT_CONFIG, useQuery, useMutation};
