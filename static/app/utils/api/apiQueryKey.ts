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
  /**
   * The resolved url that gets requested
   */
  fullUrl: ApiUrl;
  options: ApiQueryKeyOptions;
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

const API_QUERY_KEY_MARKER = '_api';

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

export function isApiQueryKey(
  queryKey: readonly unknown[]
): queryKey is ApiQueryKey | InfiniteApiQueryKey {
  return queryKey[0] === API_QUERY_KEY_MARKER;
}

export function createApiQueryKey(
  params: ApiQueryKeyParams
): readonly [typeof API_QUERY_KEY_MARKER, ApiQueryKeyParams];
export function createApiQueryKey(
  params: InfiniteApiQueryKeyParams
): readonly [typeof API_QUERY_KEY_MARKER, InfiniteApiQueryKeyParams];
export function createApiQueryKey(params: ApiQueryKeyParams | InfiniteApiQueryKeyParams) {
  return [API_QUERY_KEY_MARKER, params] as const;
}

type ApiQueryKeyFilterParams = Partial<
  Pick<ApiQueryKeyParams, 'fullUrl' | 'options' | 'urlParts'>
> & {infinite?: true};

/**
 * A partial api query key, only meant for query filters like `invalidateQueries`.
 */
export function createApiQueryKeyFilter(params: ApiQueryKeyFilterParams) {
  return [API_QUERY_KEY_MARKER, params] as const;
}
