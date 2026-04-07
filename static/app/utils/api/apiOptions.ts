import type {SkipToken} from '@tanstack/react-query';
import {infiniteQueryOptions, queryOptions, skipToken} from '@tanstack/react-query';

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

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type Options = QueryKeyEndpointOptions & {staleTime: number};

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number> | SkipToken};

const selectJson = <TData>(data: ApiResponse<TData>) => data.json;

export const selectJsonWithHeaders = <TData>(
  data: ApiResponse<TData>
): ApiResponse<TData> => data;

function _apiOptions<
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

  return queryOptions({
    queryKey:
      Object.keys(options).length > 0
        ? ([{infinite: false, version: 'v2'}, url, options] as ApiQueryKey)
        : ([{infinite: false, version: 'v2'}, url] as ApiQueryKey),
    queryFn: pathParams === skipToken ? skipToken : apiFetch<TActualData>,
    enabled: pathParams !== skipToken,
    staleTime,
    select: selectJson,
  });
}

function parsePageParam<TQueryFnData = unknown>(dir: 'previous' | 'next') {
  return ({headers}: ApiResponse<TQueryFnData>) => {
    const parsed = parseLinkHeader(headers.Link ?? null);
    return parsed[dir]?.results ? parsed[dir] : null;
  };
}

function _apiOptionsInfinite<
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

  return infiniteQueryOptions({
    queryKey:
      Object.keys(options).length > 0
        ? ([{infinite: true, version: 'v2'}, url, options] as InfiniteApiQueryKey)
        : ([{infinite: true, version: 'v2'}, url] as InfiniteApiQueryKey),
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
      _apiOptions<TManualData, TApiPath>(path, options as never),

  asInfinite:
    <TManualData>() =>
    <TApiPath extends KnownApiUrls = KnownApiUrls>(
      path: TApiPath,
      options: Options & PathParamOptions<TApiPath>
    ) =>
      _apiOptionsInfinite<TManualData, TApiPath>(path, options as never),
};
