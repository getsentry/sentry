import type {QueryFunctionContext, SkipToken} from '@tanstack/react-query';
import {infiniteQueryOptions, queryOptions, skipToken} from '@tanstack/react-query';
import type {z} from 'zod';

import {apiFetch, apiFetchInfinite} from 'sentry/utils/api/apiFetch';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {
  ApiQueryKey,
  InfiniteApiQueryKey,
  QueryKeyEndpointOptions,
} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ExtractPathParams, OptionalPathParams} from 'sentry/utils/api/getApiUrl';
import type {KnownGetsentryApiUrls} from 'sentry/utils/api/knownGetsentryApiUrls';
import type {KnownSentryApiUrls} from 'sentry/utils/api/knownSentryApiUrls.generated';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type Options = QueryKeyEndpointOptions & {staleTime: number | 'static'};

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number> | SkipToken};
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripUndefinedValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (isObject(value)) {
      const stripped = stripUndefinedValues(value);
      if (Object.keys(stripped).length > 0) {
        result[key] = stripped;
      }
      continue;
    }
    result[key] = value;
  }
  return result;
}

export const selectJson = <TData>(data: ApiResponse<TData>) => data.json;

export const selectJsonWithHeaders = <TData>(
  data: ApiResponse<TData>
): ApiResponse<TData> => data;

function _apiOptions<
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  TManualData = never,
  TApiPath extends KnownApiUrls = KnownApiUrls,
  // todo: infer the actual data type from the ApiMapping
  TActualData = TManualData,
>(
  path: TApiPath,
  ...[
    {staleTime, path: pathParams, ...options},
  ]: ExtractPathParams<TApiPath> extends never
    ? [Options & {path?: never}]
    : [Options & PathParamOptions<TApiPath>]
) {
  const url = getApiUrl(path, ...([{path: pathParams}] as OptionalPathParams<TApiPath>));
  const strippedOptions = stripUndefinedValues(options);

  return queryOptions({
    queryKey: [url, strippedOptions, {infinite: false}] as const,
    queryFn: pathParams === skipToken ? skipToken : apiFetch<TActualData>,
    enabled: pathParams !== skipToken,
    staleTime,
    select: selectJson,
  });
}

function parsePageParam<TQueryFnData = unknown>(dir: 'previous' | 'next') {
  // oxlint-disable-next-line react/function-component-definition -- This callback is not a React component.
  return ({headers}: ApiResponse<TQueryFnData>) => {
    const parsed = parseLinkHeader(headers.Link ?? null);
    return parsed[dir]?.results ? parsed[dir] : null;
  };
}

function _apiOptionsInfinite<
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  TManualData = never,
  TApiPath extends KnownApiUrls = KnownApiUrls,
  // todo: infer the actual data type from the ApiMapping
  TActualData = TManualData,
>(
  path: TApiPath,
  ...[
    {staleTime, path: pathParams, ...options},
  ]: ExtractPathParams<TApiPath> extends never
    ? [Options & {path?: never}]
    : [Options & PathParamOptions<TApiPath>]
) {
  const url = getApiUrl(path, ...([{path: pathParams}] as OptionalPathParams<TApiPath>));
  const strippedOptions = stripUndefinedValues(options);

  return infiniteQueryOptions({
    queryKey: [url, strippedOptions, {infinite: true}] as const,
    queryFn: pathParams === skipToken ? skipToken : apiFetchInfinite<TActualData>,
    getPreviousPageParam: parsePageParam('previous'),
    getNextPageParam: parsePageParam('next'),
    initialPageParam: undefined,
    enabled: pathParams !== skipToken,
    staleTime,
  });
}

/**
 * Thrown when a response body does not match the schema passed to
 * `apiOptions.schema()`.
 *
 * `cause` is the `z.ZodError`, so the standard error chain leads to the
 * individual issues. `result` is the whole failed `safeParse()` result, and
 * `response` is the untouched `ApiResponse`, which lets a caller that catches
 * this error fall back to the unvalidated `response.json`.
 */
export class ApiSchemaValidationError extends Error {
  name = 'ApiSchemaValidationError';
  cause: z.ZodError;
  result: z.ZodSafeParseError<unknown>;
  response: ApiResponse;

  constructor(url: string, result: z.ZodSafeParseError<unknown>, response: ApiResponse) {
    super(`Response from ${url} did not match the expected schema`);
    this.cause = result.error;
    this.result = result;
    this.response = response;
  }
}

function validateResponse<TSchema extends z.ZodType>(
  schema: TSchema,
  url: string,
  response: ApiResponse
): ApiResponse<z.output<TSchema>> {
  const result = schema.safeParse(response.json);
  if (!result.success) {
    throw new ApiSchemaValidationError(url, result, response);
  }
  return {headers: response.headers, json: result.data};
}

function _apiOptionsSchema<TSchema extends z.ZodType, TApiPath extends KnownApiUrls>(
  schema: TSchema,
  path: TApiPath,
  ...[
    {staleTime, path: pathParams, ...options},
  ]: ExtractPathParams<TApiPath> extends never
    ? [Options & {path?: never}]
    : [Options & PathParamOptions<TApiPath>]
) {
  const url = getApiUrl(path, ...([{path: pathParams}] as OptionalPathParams<TApiPath>));
  const strippedOptions = stripUndefinedValues(options);

  // The schema is deliberately absent from the queryKey: it is a parsing
  // concern, not part of the cache identity, and keying on it would give an
  // inline schema a new identity on every render.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: [url, strippedOptions, {infinite: false}] as const,
    queryFn:
      pathParams === skipToken
        ? skipToken
        : async (context: QueryFunctionContext<ApiQueryKey>) =>
            validateResponse(schema, url, await apiFetch(context)),
    enabled: pathParams !== skipToken,
    staleTime,
    select: selectJson,
  });
}

function _apiOptionsSchemaInfinite<
  TSchema extends z.ZodType,
  TApiPath extends KnownApiUrls,
>(
  schema: TSchema,
  path: TApiPath,
  ...[
    {staleTime, path: pathParams, ...options},
  ]: ExtractPathParams<TApiPath> extends never
    ? [Options & {path?: never}]
    : [Options & PathParamOptions<TApiPath>]
) {
  const url = getApiUrl(path, ...([{path: pathParams}] as OptionalPathParams<TApiPath>));
  const strippedOptions = stripUndefinedValues(options);

  // See the note in `_apiOptionsSchema` about keeping the schema out of the queryKey.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return infiniteQueryOptions({
    queryKey: [url, strippedOptions, {infinite: true}] as const,
    queryFn:
      pathParams === skipToken
        ? skipToken
        : async (
            context: QueryFunctionContext<
              InfiniteApiQueryKey,
              null | undefined | ParsedHeader
            >
          ) => validateResponse(schema, url, await apiFetchInfinite(context)),
    getPreviousPageParam: parsePageParam('previous'),
    getNextPageParam: parsePageParam('next'),
    initialPageParam: undefined,
    enabled: pathParams !== skipToken,
    staleTime,
  });
}

/**
 * Type-safe factory for TanStack Query options that hit Sentry API endpoints.
 *
 * By default, `select` extracts the JSON body. To also access response headers
 * (e.g. `Link` for pagination), override with `selectJsonWithHeaders`.
 *
 * @example Basic usage
 * ```ts
 * const query = useQuery(
 *   apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
 *     path: {organizationIdOrSlug: organization.slug},
 *     staleTime: 30_000,
 *   })
 * );
 * // query.data is Project[]
 * ```
 *
 * @example Conditional fetching
 * ```ts
 * const query = useQuery(
 *   apiOptions.as<Project>()('/organizations/$organizationIdOrSlug/projects/$projectIdOrSlug/', {
 *     path: projectSlug
 *       ? {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug}
 *       : skipToken,
 *     staleTime: 30_000,
 *   })
 * );
 * ```
 *
 * @example With response headers (pagination)
 * ```ts
 * const {data} = useQuery({
 *   ...apiOptions.as<Item[]>()('/organizations/$organizationIdOrSlug/items/', {
 *     path: {organizationIdOrSlug: organization.slug},
 *     query: {cursor, per_page: 25},
 *     staleTime: 0,
 *   }),
 *   select: selectJsonWithHeaders,
 * });
 * // data is ApiResponse<Item[]>
 * const items = data?.json ?? [];
 * const pageLinks = data?.headers.Link;
 * ```
 *
 * @example Validating the response with a zod schema
 * ```ts
 * const ProjectSchema = z.object({id: z.string(), slug: z.string()});
 *
 * const query = useQuery(
 *   apiOptions.schema(
 *     z.array(ProjectSchema),
 *     '/organizations/$organizationIdOrSlug/projects/',
 *     {path: {organizationIdOrSlug: organization.slug}, staleTime: 30_000}
 *   )
 * );
 * // query.data is z.infer<typeof ProjectSchema>[]
 * ```
 */
export const apiOptions = {
  as:
    <TManualData>() =>
    <TApiPath extends KnownApiUrls = KnownApiUrls>(
      path: TApiPath,
      options: Options & PathParamOptions<TApiPath>
    ) =>
      _apiOptions<TManualData>(path, options as never),

  asInfinite:
    <TManualData>() =>
    <TApiPath extends KnownApiUrls = KnownApiUrls>(
      path: TApiPath,
      options: Options & PathParamOptions<TApiPath>
    ) =>
      _apiOptionsInfinite<TManualData>(path, options as never),

  /**
   * Like `apiOptions.as()`, but the response body is validated against `schema`
   * before it enters the query cache. `data` is typed as the schema's output,
   * so any transforms/defaults/coercions the schema declares are applied.
   *
   * A response that fails validation rejects the query with an
   * `ApiSchemaValidationError`.
   */
  schema: <TSchema extends z.ZodType, TApiPath extends KnownApiUrls = KnownApiUrls>(
    schema: TSchema,
    path: TApiPath,
    options: Options & PathParamOptions<TApiPath>
  ) => _apiOptionsSchema<TSchema, TApiPath>(schema, path, options as never),

  /**
   * The infinite-query counterpart to `apiOptions.schema()`. Each page is
   * validated as it is fetched.
   */
  schemaInfinite: <
    TSchema extends z.ZodType,
    TApiPath extends KnownApiUrls = KnownApiUrls,
  >(
    schema: TSchema,
    path: TApiPath,
    options: Options & PathParamOptions<TApiPath>
  ) => _apiOptionsSchemaInfinite<TSchema, TApiPath>(schema, path, options as never),
};
