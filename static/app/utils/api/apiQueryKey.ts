import type {getApiUrl} from 'sentry/utils/api/getApiUrl';

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

export type CanonicalApiQueryKey = readonly [
  ApiUrl,
  QueryKeyEndpointOptions,
  {infinite: false},
];

// Loose input forms accepted at the useApiQuery / setApiQueryData / getApiQueryData
// boundary for backward compatibility. Normalized to the canonical 3-slot form via
// `normalizeQueryKey` before the key reaches the cache.
type LooseApiQueryKey = readonly [ApiUrl] | readonly [ApiUrl, QueryKeyEndpointOptions];

export type ApiQueryKey = LooseApiQueryKey | CanonicalApiQueryKey;
export type InfiniteApiQueryKey = readonly [
  ApiUrl,
  QueryKeyEndpointOptions,
  {infinite: true},
];

type ParsedQueryKey = {
  isInfinite: boolean;
  options: QueryKeyEndpointOptions;
  url: ApiUrl;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEndpointOptions(value: unknown): value is QueryKeyEndpointOptions {
  return isRecord(value);
}

/**
 * Validates the canonical `[url, options, {infinite}]` form. Returns undefined
 * for anything else, including keys with more or fewer than three slots.
 */
function toParsedQueryKey(queryKey: readonly unknown[]): ParsedQueryKey | undefined {
  if (queryKey.length !== 3) {
    return undefined;
  }
  const [url, options, marker] = queryKey;
  if (
    typeof url !== 'string' ||
    !isEndpointOptions(options) ||
    !isRecord(marker) ||
    typeof marker.infinite !== 'boolean'
  ) {
    return undefined;
  }
  return {url: url as ApiUrl, options, isInfinite: marker.infinite};
}

export function parseQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): ParsedQueryKey {
  const normalized = queryKey.length === 3 ? queryKey : normalizeQueryKey(queryKey);
  const parsed = toParsedQueryKey(normalized);
  if (!parsed) {
    throw new Error('Invalid API query key');
  }
  return parsed;
}

const safeParseCache = new WeakMap<readonly unknown[], ParsedQueryKey | undefined>();

export function safeParseQueryKey(
  queryKey: readonly unknown[]
): ParsedQueryKey | undefined {
  if (safeParseCache.has(queryKey)) {
    return safeParseCache.get(queryKey);
  }

  const result = toParsedQueryKey(queryKey);
  safeParseCache.set(queryKey, result);
  return result;
}

export function normalizeQueryKey(key: ApiQueryKey): CanonicalApiQueryKey {
  if (key.length === 3) {
    return key;
  }
  const [url, options] = key;
  return [url, options ?? {}, {infinite: false}] as const;
}
