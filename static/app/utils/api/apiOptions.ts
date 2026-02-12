import {queryOptions, skipToken} from '@tanstack/react-query';
import type {SkipToken} from '@tanstack/react-query';

import type {ApiResult} from 'sentry/api';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ExtractPathParams, OptionalPathParams} from 'sentry/utils/api/getApiUrl';
import type {KnownGetsentryApiUrls} from 'sentry/utils/api/knownGetsentryApiUrls';
import type {KnownSentryApiUrls} from 'sentry/utils/api/knownSentryApiUrls.generated';
import type {QueryKeyEndpointOptions} from 'sentry/utils/queryClient';
import {fetchDataQuery} from 'sentry/utils/queryClient';

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type Options = QueryKeyEndpointOptions & {staleTime: number};

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number> | SkipToken};

const selectContent = <TData>(data: ApiResult<TData>) => data[0];
/** @public **/
export const selectWithHeaders =
  <THeaders extends readonly string[]>(headers: THeaders) =>
  <TData>(data: ApiResult<TData>) => ({
    content: data[0],
    headers: Object.fromEntries(
      headers.flatMap(header => {
        const value = data[2]?.getResponseHeader(header);
        return value ? [[header, value]] : [];
      })
    ) as Record<THeaders[number], string | undefined>,
  });

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
      Object.keys(options).length > 0 ? ([url, options] as const) : ([url] as const),
    queryFn: pathParams === skipToken ? skipToken : fetchDataQuery<TActualData>,
    enabled: pathParams !== skipToken,
    staleTime,
    select: selectContent,
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
