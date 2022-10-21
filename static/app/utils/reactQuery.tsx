import * as rq from '@tanstack/react-query';

import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type QueryKeyEndpointOptions = {
  query?: Record<string, any>;
};

type QueryKey = readonly [string] | readonly [string, QueryKeyEndpointOptions];

type UseQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> = Omit<
  rq.UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'queryKey' | 'queryFn'
>;

/**
 * Wraps reqct-query's useQuery for consistent usage in the Sentry app.
 * Query keys should be an array which include an endpoint URL and options such as query params.
 * This wrapper will execute the request using the query key URL, but if you need custom behavior
 * you may supply your own query function as the second argument.
 *
 * See https://tanstack.com/query/v4/docs/overview for docs on react-query.
 *
 * Example usage:
 *
 * const { data, isLoading, isError } = useQuery<EventsResponse>(['/events', { query: { limit: 50 }}])
 */
function useQuery<TQueryFnData, TError = RequestError, TData = TQueryFnData>(
  queryKey: QueryKey,
  queryFnOrQueryOptions?:
    | rq.QueryFunction<TQueryFnData, QueryKey>
    | UseQueryOptions<TQueryFnData, TError, TData, QueryKey>,
  queryOptions?: UseQueryOptions<TQueryFnData, TError, TData, QueryKey>
) {
  const api = useApi();

  const [path, endpointOptions] = queryKey;

  const defaultQueryFn: rq.QueryFunction<TQueryFnData, QueryKey> = async () => {
    const data = await api.requestPromise(path, {
      method: 'GET',
      query: endpointOptions?.query,
    });

    return data;
  };

  const queryFn =
    typeof queryFnOrQueryOptions === 'function' ? queryFnOrQueryOptions : defaultQueryFn;

  return rq.useQuery(queryKey, queryFn, queryOptions);
}

const useQueryClient = rq.useQueryClient;

export {useQuery, useQueryClient};
