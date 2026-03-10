import type getApiUrl from 'sentry/utils/api/getApiUrl';

export type RequestMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

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
type PlainQueryKey =
  | readonly [url: ReturnType<typeof getApiUrl>]
  | readonly [
      url: ReturnType<typeof getApiUrl>,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];
type ApiOptionsQueryKey =
  | readonly ['apiOptions', url: ReturnType<typeof getApiUrl>]
  | readonly [
      'apiOptions',
      url: ReturnType<typeof getApiUrl>,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];

export type ApiQueryKey = PlainQueryKey | ApiOptionsQueryKey;

/**
 * @deprecated Prefer using `apiOptions.asInfinite<T>()(...args)` whenever possible.
 */
type PlainInfiniteQueryKey =
  | readonly ['infinite', url: ReturnType<typeof getApiUrl>]
  | readonly [
      'infinite',
      url: ReturnType<typeof getApiUrl>,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];
type ApiOptionsInfiniteQueryKey =
  | readonly ['apiOptions', 'infinite', url: ReturnType<typeof getApiUrl>]
  | readonly [
      'apiOptions',
      'infinite',
      url: ReturnType<typeof getApiUrl>,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];

export type InfiniteApiQueryKey = PlainInfiniteQueryKey | ApiOptionsInfiniteQueryKey;

function isApiOptionsQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): queryKey is ApiOptionsQueryKey | ApiOptionsInfiniteQueryKey {
  return queryKey[0] === 'apiOptions';
}
function isPlainInfiniteQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): queryKey is PlainInfiniteQueryKey {
  return queryKey[0] === 'infinite';
}
function isApiOptionsInfiniteQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): queryKey is ApiOptionsInfiniteQueryKey {
  return queryKey[1] === 'infinite';
}

export function parseQueryKey(queryKey: ApiQueryKey | InfiniteApiQueryKey) {
  if (isApiOptionsQueryKey(queryKey)) {
    return isApiOptionsInfiniteQueryKey(queryKey)
      ? {isInfinite: true, url: queryKey[2], options: queryKey[3]}
      : {isInfinite: false, url: queryKey[1], options: queryKey[2]};
  }
  return isPlainInfiniteQueryKey(queryKey)
    ? {isInfinite: true, url: queryKey[1], options: queryKey[2]}
    : {isInfinite: false, url: queryKey[0], options: queryKey[1]};
}
