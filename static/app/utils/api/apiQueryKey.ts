import {z} from 'zod';

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

const apiUrlSchema = z.custom<ApiUrl>(val => typeof val === 'string');
const optionsSchema = z.custom<QueryKeyEndpointOptions>(
  val => typeof val === 'object' && val !== null && !Array.isArray(val)
);
const markerSchema = z.object({infinite: z.boolean()});

const queryKeySchema = z
  .tuple([apiUrlSchema, optionsSchema, markerSchema])
  .transform(([url, options, marker]) => ({
    url,
    options,
    isInfinite: marker.infinite,
  }));

export type CanonicalApiQueryKey = readonly [
  ApiUrl,
  QueryKeyEndpointOptions,
  {infinite: false},
];

// Legacy input forms accepted by query-key parsing and normalized to three slots.
type LooseApiQueryKey = readonly [ApiUrl] | readonly [ApiUrl, QueryKeyEndpointOptions];

export type ApiQueryKey = LooseApiQueryKey | CanonicalApiQueryKey;
export type InfiniteApiQueryKey = readonly [
  ApiUrl,
  QueryKeyEndpointOptions,
  {infinite: true},
];

type ParsedQueryKey = z.infer<typeof queryKeySchema>;

export function parseQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): ParsedQueryKey {
  const normalized = queryKey.length === 3 ? queryKey : normalizeQueryKey(queryKey);
  return queryKeySchema.parse(normalized);
}

const safeParseCache = new WeakMap<readonly unknown[], ParsedQueryKey | undefined>();

export function safeParseQueryKey(
  queryKey: readonly unknown[]
): ParsedQueryKey | undefined {
  if (safeParseCache.has(queryKey)) {
    return safeParseCache.get(queryKey);
  }

  const result = queryKeySchema.safeParse(queryKey).data;
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
