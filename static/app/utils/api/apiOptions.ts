import type {SkipToken} from '@tanstack/react-query';
import {infiniteQueryOptions, queryOptions, skipToken} from '@tanstack/react-query';

import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';

import {apiFetch, apiFetchInfinite} from './apiFetch';
import type {ApiResponse} from './apiFetch';
import {
  createApiQueryKey,
  createApiQueryKeyFilter,
  type QueryKeyEndpointOptions,
} from './apiQueryKey';
import {getApiUrl} from './getApiUrl';
import type {ExtractPathParams, OptionalPathParams} from './getApiUrl';
import type {KnownGetsentryApiUrls} from './knownGetsentryApiUrls';
import type {KnownSentryApiUrls} from './knownSentryApiUrls.generated';

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type Options = QueryKeyEndpointOptions & {staleTime: number | 'static'};

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number> | SkipToken};

type SegmentPrefixes<
  TUrl extends string,
  TPrefix extends string = '/',
> = TUrl extends `${TPrefix}${infer Segment}/${infer Rest}`
  ?
      | `${TPrefix}${Segment}/`
      | SegmentPrefixes<`${TPrefix}${Segment}/${Rest}`, `${TPrefix}${Segment}/`>
  : never;

/**
 * A known url, or a known url prefix that ends in `/*` to also match every url below it.
 */
type KnownApiUrlPattern = KnownApiUrls | `${SegmentPrefixes<KnownApiUrls>}*`;

/**
 * Exact urls need every path param. Prefixes may leave params open, but still need
 * a `path` object, so matching every organization is written as `path: {}`.
 */
type PatternPathOptions<TPattern extends string> = TPattern extends `${infer TPrefix}*`
  ? ExtractPathParams<TPrefix> extends never
    ? {path?: never}
    : {path: Partial<Record<ExtractPathParams<TPrefix>, string | number>>}
  : ExtractPathParams<TPattern> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TPattern>, string | number>};

type PartialQueryKeyOptions<TPattern extends string> = QueryKeyEndpointOptions &
  PatternPathOptions<TPattern> & {infinite?: true};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
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
  // Only drops undefined values and the empty objects they leave behind
  return result as T;
}

function stringifyPathParams(
  pathParams: Record<string, string | number> | SkipToken | undefined
): Record<string, string> | undefined {
  if (!pathParams || pathParams === skipToken) {
    return;
  }
  return Object.fromEntries(
    Object.entries(pathParams).map(([key, value]) => [key, String(value)])
  );
}

function getQueryKeyParams(
  path: KnownApiUrls,
  pathParams: Record<string, string | number> | SkipToken | undefined,
  options: QueryKeyEndpointOptions
) {
  return {
    fullUrl: getApiUrl(
      path,
      ...([{path: pathParams}] as OptionalPathParams<KnownApiUrls>)
    ),
    urlParts: path.split('/').filter(Boolean),
    options: stripUndefinedValues({
      ...options,
      path: stringifyPathParams(pathParams),
    }),
  };
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
  return queryOptions({
    queryKey: createApiQueryKey(getQueryKeyParams(path, pathParams, options)),
    queryFn: pathParams === skipToken ? skipToken : apiFetch<TActualData>,
    enabled: pathParams !== skipToken,
    staleTime,
    select: selectJson,
  });
}

function _partialQueryKey(
  url: string,
  {
    path,
    infinite,
    ...options
  }: QueryKeyEndpointOptions & {
    infinite?: true;
    path?: Record<string, string | number>;
  } = {}
) {
  const isPrefix = url.endsWith('*');
  const keyOptions = stripUndefinedValues({
    ...options,
    path: isPrefix ? stringifyPathParams(path) : undefined,
  });

  return createApiQueryKeyFilter({
    ...(isPrefix
      ? {urlParts: url.slice(0, -1).split('/').filter(Boolean)}
      : {
          fullUrl: getApiUrl(
            url as KnownApiUrls,
            ...([{path}] as OptionalPathParams<KnownApiUrls>)
          ),
        }),
    ...(Object.keys(keyOptions).length > 0 ? {options: keyOptions} : {}),
    ...(infinite ? {infinite} : {}),
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
  return infiniteQueryOptions({
    queryKey: createApiQueryKey({
      ...getQueryKeyParams(path, pathParams, options),
      infinite: true,
    }),
    queryFn: pathParams === skipToken ? skipToken : apiFetchInfinite<TActualData>,
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
   * A partial query key for query filters like `invalidateQueries`.
   *
   * A url without `*` matches exactly that url, with any other options. A prefix
   * ending in `/*` matches that url and everything below it, and leaves path
   * params that are not passed open.
   *
   * @example
   * ```ts
   * apiOptions.partialQueryKey('/organizations/$organizationIdOrSlug/repos/', {
   *   path: {organizationIdOrSlug: organization.slug},
   * });
   * apiOptions.partialQueryKey('/organizations/$organizationIdOrSlug/issues/*', {
   *   path: {organizationIdOrSlug: organization.slug},
   * });
   * ```
   */
  partialQueryKey: <TPattern extends KnownApiUrlPattern>(
    url: TPattern,
    ...[options]: PatternPathOptions<TPattern> extends {path: unknown}
      ? [PartialQueryKeyOptions<TPattern>]
      : [PartialQueryKeyOptions<TPattern>?]
  ) => _partialQueryKey(url, options as never),
};
