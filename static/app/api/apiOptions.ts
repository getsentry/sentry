import {queryOptions, skipToken, type SkipToken} from '@tanstack/react-query';

import type {ApiResult} from 'sentry/api';
import {fetchDataQuery, type QueryKeyEndpointOptions} from 'sentry/utils/queryClient';

import type {MaybeApiPath} from './apiDefinition';
import {getApiUrl, type ExtractPathParams, type OptionalPathParams} from './getApiUrl';

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
  TApiPath extends MaybeApiPath = MaybeApiPath,
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
  const url =
    pathParams === skipToken
      ? null
      : getApiUrl(
          path,
          ...([
            {
              path: pathParams,
            },
          ] as OptionalPathParams<TApiPath>)
        );

  return queryOptions({
    queryKey:
      url === null
        ? [path]
        : Object.keys(options).length > 0
          ? ([url, options] as const)
          : ([url] as const),
    queryFn: url === null ? skipToken : fetchDataQuery<TActualData>,
    staleTime,
    select: selectContent,
  });
}

export const apiOptions = {
  as:
    <TManualData>() =>
    <TApiPath extends MaybeApiPath = MaybeApiPath>(
      path: TApiPath,
      options: Options & PathParamOptions<TApiPath>
    ) =>
      _apiOptions<TManualData, TApiPath>(path, options as never),
};
