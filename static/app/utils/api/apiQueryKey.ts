import {z} from 'zod';

import type {getApiUrl} from 'sentry/utils/api/getApiUrl';

export type RequestMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

type ApiUrl = ReturnType<typeof getApiUrl>;

export type QueryKeyEndpointOptions = {
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  host?: string;
  method?: RequestMethod;
  query?: Record<string, unknown>;
};

const apiUrlSchema = z.custom<ApiUrl>(val => typeof val === 'string');
const optionsSchema = z.custom<QueryKeyEndpointOptions>(
  val => typeof val === 'object' && val !== null && !Array.isArray(val)
);

const v1InfiniteMarkerSchema = z.object({
  version: z.literal('v1'),
  infinite: z.literal(true),
});
const v2MarkerSchema = z.object({
  version: z.literal('v2'),
  infinite: z.literal(false),
});
const v2InfiniteMarkerSchema = z.object({
  version: z.literal('v2'),
  infinite: z.literal(true),
});

const v1Schema = z.union([
  z.tuple([apiUrlSchema]),
  z.tuple([apiUrlSchema, optionsSchema]),
]);
const v1InfiniteSchema = z.union([
  z.tuple([v1InfiniteMarkerSchema, apiUrlSchema]),
  z.tuple([v1InfiniteMarkerSchema, apiUrlSchema, optionsSchema]),
]);
const v2Schema = z.union([
  z.tuple([v2MarkerSchema, apiUrlSchema]),
  z.tuple([v2MarkerSchema, apiUrlSchema, optionsSchema]),
]);
const v2InfiniteSchema = z.union([
  z.tuple([v2InfiniteMarkerSchema, apiUrlSchema]),
  z.tuple([v2InfiniteMarkerSchema, apiUrlSchema, optionsSchema]),
]);

// Distributes Readonly<> over a union so each branch becomes a readonly tuple.
type ReadonlyTuple<T> = T extends readonly unknown[] ? Readonly<T> : never;

/**
 * @deprecated Prefer using `apiOptions.as<T>()(...args)` whenever possible.
 */
type V1QueryKey = ReadonlyTuple<z.infer<typeof v1Schema>>;
type V2QueryKey = ReadonlyTuple<z.infer<typeof v2Schema>>;

export type ApiQueryKey = V1QueryKey | V2QueryKey;

/**
 * @deprecated Prefer using `apiOptions.asInfinite<T>()(...args)` whenever possible.
 */
type V1InfiniteQueryKey = ReadonlyTuple<z.infer<typeof v1InfiniteSchema>>;
type V2InfiniteQueryKey = ReadonlyTuple<z.infer<typeof v2InfiniteSchema>>;

export type InfiniteApiQueryKey = V1InfiniteQueryKey | V2InfiniteQueryKey;

const queryKeySchema = z.union([
  v1Schema.transform(([url, options]) => ({
    version: 'v1' as const,
    isInfinite: false,
    url,
    options,
  })),
  v1InfiniteSchema.transform(([, url, options]) => ({
    version: 'v1' as const,
    isInfinite: true,
    url,
    options,
  })),
  v2Schema.transform(([, url, options]) => ({
    version: 'v2' as const,
    isInfinite: false,
    url,
    options,
  })),
  v2InfiniteSchema.transform(([, url, options]) => ({
    version: 'v2' as const,
    isInfinite: true,
    url,
    options,
  })),
]);

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
