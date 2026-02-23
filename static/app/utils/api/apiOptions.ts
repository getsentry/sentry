import {queryOptions, skipToken} from '@tanstack/react-query';
import type {SkipToken} from '@tanstack/react-query';

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ExtractPathParams, OptionalPathParams} from 'sentry/utils/api/getApiUrl';
import type {KnownGetsentryApiUrls} from 'sentry/utils/api/knownGetsentryApiUrls';
import type {KnownSentryApiUrls} from 'sentry/utils/api/knownSentryApiUrls.generated';
import type {ApiQueryKey, QueryKeyEndpointOptions} from 'sentry/utils/queryClient';

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type Options = QueryKeyEndpointOptions & {staleTime: number};

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number> | SkipToken};

/** @public **/
export const selectJson = <TData>(data: ApiResponse<TData>) => data.json;

/** @public **/
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
  const url = getApiUrl(
    path,
    ...([
      {
        path: pathParams,
      },
    ] as OptionalPathParams<TApiPath>)
  );

  return queryOptions({
    queryKey:
      Object.keys(options).length > 0
        ? ([url, options] as ApiQueryKey)
        : ([url] as ApiQueryKey),
    queryFn: pathParams === skipToken ? skipToken : apiFetch<TActualData>,
    enabled: pathParams !== skipToken,
    staleTime,
    select: selectJson,
  });
}

export const apiOptions = {
  as:
    <TManualData>() =>
    <TApiPath extends KnownApiUrls = KnownApiUrls>(
      path: TApiPath,
      options: Options & PathParamOptions<TApiPath>
    ) =>
      _apiOptions<TManualData, TApiPath>(path, options as never),
};
