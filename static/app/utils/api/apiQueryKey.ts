import type getApiUrl from 'sentry/utils/api/getApiUrl';

export type RequestMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

type ApiUrl = ReturnType<typeof getApiUrl>;

export type QueryKeyEndpointOptions<
  Headers = Record<string, string>,
  Query = Record<string, any>,
  Data = Record<string, any>,
> = {
  data?: Data;
  headers?: Headers;
  host?: string;
  method?: RequestMethod;
  query?: Query;
};

/**
 * @deprecated Prefer using `apiOptions.as<T>()(...args)` whenever possible.
 */
type V1QueryKey =
  | readonly [url: ApiUrl]
  | readonly [url: ApiUrl, options: QueryKeyEndpointOptions];
type V2QueryKey =
  | readonly [{infinite: false; version: 'v2'}, url: ApiUrl]
  | readonly [
      {infinite: false; version: 'v2'},
      url: ApiUrl,
      options: QueryKeyEndpointOptions,
    ];

export type ApiQueryKey = V1QueryKey | V2QueryKey;

/**
 * @deprecated Prefer using `apiOptions.asInfinite<T>()(...args)` whenever possible.
 */
type V1InfiniteQueryKey =
  | readonly [{infinite: true; version: 'v1'}, url: ApiUrl]
  | readonly [
      {infinite: true; version: 'v1'},
      url: ApiUrl,
      options: QueryKeyEndpointOptions,
    ];
type V2InfiniteQueryKey =
  | readonly [{infinite: true; version: 'v2'}, url: ApiUrl]
  | readonly [
      {infinite: true; version: 'v2'},
      url: ApiUrl,
      options: QueryKeyEndpointOptions,
    ];

export type InfiniteApiQueryKey = V1InfiniteQueryKey | V2InfiniteQueryKey;

function isV2QueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): queryKey is V2QueryKey | V2InfiniteQueryKey {
  return typeof queryKey[0] === 'object' && queryKey[0].version === 'v2';
}
function isInfiniteQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): queryKey is V1InfiniteQueryKey | V2InfiniteQueryKey {
  return typeof queryKey[0] === 'object' && queryKey[0].infinite;
}

export function parseQueryKey(queryKey: ApiQueryKey | InfiniteApiQueryKey) {
  if (isInfiniteQueryKey(queryKey)) {
    return {
      version: isV2QueryKey(queryKey) ? 'v2' : 'v1',
      isInfinite: true,
      url: queryKey[1],
      options: queryKey[2],
    };
  }
  return isV2QueryKey(queryKey)
    ? {version: 'v2', isInfinite: false, url: queryKey[1], options: queryKey[2]}
    : {version: 'v1', isInfinite: false, url: queryKey[0], options: queryKey[1]};
}
