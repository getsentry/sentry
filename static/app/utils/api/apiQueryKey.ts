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
  .rest(z.unknown())
  .transform(([url, options, marker]) => ({
    url,
    options,
    isInfinite: marker.infinite,
  }));

export type ApiQueryKey = readonly [
  ApiUrl,
  QueryKeyEndpointOptions,
  {infinite: false},
  ...unknown[],
];

export type InfiniteApiQueryKey = readonly [
  ApiUrl,
  QueryKeyEndpointOptions,
  {infinite: true},
  ...unknown[],
];

type ParsedQueryKey = z.infer<typeof queryKeySchema>;

export function parseQueryKey(
  queryKey: ApiQueryKey | InfiniteApiQueryKey
): ParsedQueryKey {
  return queryKeySchema.parse(queryKey);
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
