import type {
  QueryClient,
  QueryClientConfig,
  SetDataOptions,
  Updater,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import {Client} from 'sentry/api';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {selectJson} from 'sentry/utils/api/apiOptions';
import {normalizeQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {
  ApiQueryKey,
  InfiniteApiQueryKey,
  QueryKeyEndpointOptions,
} from 'sentry/utils/api/apiQueryKey';
import type {RequestError} from 'sentry/utils/requestError/requestError';

export type {
  /**
   * @deprecated Use `import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';` directly instead.
   */
  ApiQueryKey,
  /**
   * @deprecated Use `import type {InfiniteApiQueryKey} from 'sentry/utils/api/apiQueryKey';` directlyinstead.
   */
  InfiniteApiQueryKey,
  /**
   * @deprecated Use `import type {QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';` directly instead.
   */
  QueryKeyEndpointOptions,
};

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

export const QUERY_API_CLIENT = new Client();

export interface UseApiQueryOptions<TApiResponse, TError = RequestError> extends Omit<
  UseQueryOptions<ApiResponse<TApiResponse>, TError, TApiResponse, ApiQueryKey>,
  // This is an explicit option in our function
  | 'queryKey'
  // This will always be a useApi api Query
  | 'queryFn'
  // We do not include the select option as the wrapper owns the .json extraction.
  // Use `apiOptions` directly if you need a custom select.
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

export type UseApiQueryResult<TData, TError> = UseQueryResult<TData, TError>;

/**
 * Wraps React Query's useQuery for consistent usage in the Sentry app.
 * Query keys should be an array which include an endpoint URL and options such as query params.
 * This wrapper will execute the request using the query key URL.
 *
 * See https://tanstack.com/query/v5/docs/framework/react/overview for docs on React Query.
 *
 * Example usage:
 *
 * const {data, isLoading, isError} = useApiQuery<EventsResponse>(
 *   ['/events', {query: {limit: 50}}],
 *   {staleTime: 0}
 * );
 * @deprecated prefer apiOptions and pass them directly to useQuery
 */
export function useApiQuery<TResponseData, TError = RequestError>(
  queryKey: ApiQueryKey,
  options: UseApiQueryOptions<TResponseData, TError>
): UseApiQueryResult<TResponseData, TError> {
  return useQuery({
    queryKey: normalizeQueryKey(queryKey),
    queryFn: apiFetch<TResponseData>,
    select: selectJson,
    ...options,
  });
}

/**
 * Wraps React Query's queryClient.getQueryData to return only the cached API
 * response body. The underlying cache stores `ApiResponse<T> = {json, headers}`;
 * this helper unwraps `.json`.
 * @deprecated Use queryClient.getQuryData directly with apiOptions or queryOptions — they infer the correct type from the query key
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function getApiQueryData<TResponseData>(
  queryClient: QueryClient,
  queryKey: ApiQueryKey
): TResponseData | undefined {
  // eslint-disable-next-line @sentry/no-query-data-type-parameters
  return queryClient.getQueryData<ApiResponse<TResponseData>>(normalizeQueryKey(queryKey))
    ?.json;
}

/**
 * Wraps React Query's queryClient.setQueryData to allow setting of API
 * response data without needing to provide a request object. The underlying cache
 * stores `ApiResponse<T> = {json, headers}`; this helper writes `{json: newData,
 * headers: prev?.headers ?? {}}`.
 * @deprecated Use queryClient.setQueryData directly with apiOptions or queryOptions — they infer the correct type from the query key
 */
export function setApiQueryData<TResponseData>(
  queryClient: QueryClient,
  queryKey: ApiQueryKey,
  updater: Updater<TResponseData | undefined, TResponseData | undefined>,
  options?: SetDataOptions
): TResponseData | undefined {
  // eslint-disable-next-line @sentry/no-query-data-type-parameters
  const updateResult = queryClient.setQueryData<ApiResponse<TResponseData>>(
    normalizeQueryKey(queryKey),
    previous => {
      const prevJson = previous?.json;
      const newData =
        typeof updater === 'function'
          ? (updater as (input?: TResponseData) => TResponseData | undefined)(prevJson)
          : updater;

      if (newData === undefined) {
        return previous;
      }
      return {json: newData, headers: previous?.headers ?? {}};
    },
    options
  );

  return updateResult?.json;
}

type ApiMutationVariables = {
  method: 'PUT' | 'POST' | 'DELETE';
  url: string;
  data?: Record<string, unknown>;
  options?: Pick<QueryKeyEndpointOptions, 'query' | 'headers' | 'host'>;
};

/**
 * This method can be used as a default `mutationFn` with `useMutation` hook.
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
