import type {getApiUrl} from './getApiUrl';

export type RequestMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

type ApiUrl = ReturnType<typeof getApiUrl>;

export type QueryKeyEndpointOptions = {
  allowAuthError?: boolean;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  host?: string;
  includeAllArgs?: boolean;
  method?: RequestMethod;
  query?: Record<string, unknown>;
};

type ApiQueryKeyOptions = QueryKeyEndpointOptions & {
  path?: Record<string, string>;
};

type ApiQueryKeyParams = {
  options: ApiQueryKeyOptions;
  /**
   * The resolved url that gets requested
   */
  url: ApiUrl;
  /**
   * The url template split into segments, with `$param` placeholders kept.
   * Use it to match every query below a url prefix, across all param values.
   */
  urlParts: readonly string[];
  /**
   * Only set on infinite queries, so a non-infinite key used as a filter
   * matches both variants of the same url.
   */
  infinite?: never;
};

type InfiniteApiQueryKeyParams = Omit<ApiQueryKeyParams, 'infinite'> & {
  infinite: true;
};

export const API_QUERY_KEY_MARKER = '_api';

export type ApiQueryKey = readonly [
  typeof API_QUERY_KEY_MARKER,
  ApiQueryKeyParams,
  ...unknown[],
];

export type InfiniteApiQueryKey = readonly [
  typeof API_QUERY_KEY_MARKER,
  InfiniteApiQueryKeyParams,
  ...unknown[],
];

/**
 * The request params of an api query key, as `parseQueryKey` returns them.
 */
export type ParsedQueryKey = ApiQueryKeyParams | InfiniteApiQueryKeyParams;

function isApiQueryKey(
  queryKey: readonly unknown[]
): queryKey is ApiQueryKey | InfiniteApiQueryKey {
  return queryKey[0] === API_QUERY_KEY_MARKER;
}

/**
 * Reads the request params of an api query key, without coupling callers to the key's layout.
 */
export function parseQueryKey<TQueryKey extends ApiQueryKey | InfiniteApiQueryKey>(
  queryKey: TQueryKey
): TQueryKey[1] {
  return queryKey[1];
}

/**
 * Like `parseQueryKey`, but for keys that may not be api query keys.
 */
export function safeParseQueryKey(
  queryKey: readonly unknown[]
): ParsedQueryKey | undefined {
  return isApiQueryKey(queryKey) ? parseQueryKey(queryKey) : undefined;
}
