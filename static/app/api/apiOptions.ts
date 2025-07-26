import {queryOptions} from '@tanstack/react-query';

import type {ApiResult} from 'sentry/api';
import {fetchDataQuery, type QueryKeyEndpointOptions} from 'sentry/utils/queryClient';

import type {ApiMapping, ApiPath, MaybeApiPath} from './apiDefinition';

function safeEncodeURIComponent(input: string) {
  try {
    // If decoding and re-encoding gives the same string, it's already encoded
    if (encodeURIComponent(decodeURIComponent(input)) === input) {
      return input;
    }
  } catch (e) {
    // decodeURIComponent threw an error, so it was not encoded
  }
  return encodeURIComponent(input);
}

// Extract all `$param` names from a given path string type
type ExtractPathParams<TApiPath extends string> =
  TApiPath extends `${string}$${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<`/${Rest}`>
    : TApiPath extends `${string}$${infer Param}`
      ? Param
      : never;

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number>};

type Options = QueryKeyEndpointOptions & {staleTime: number};

const paramRegex = /\$([a-zA-Z0-9_-]+)/g;

const selectContent = <TData>(data: ApiResult<TData>) => data[0];

type OptionalPathParams<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? [] // eslint-disable-line @typescript-eslint/no-restricted-types
    : [PathParamOptions<TApiPath>];

export function getApiUrl<TApiPath extends string>(
  path: TApiPath,
  ...[options]: OptionalPathParams<TApiPath>
) {
  let url: string = path;
  const pathParams = options?.path;
  if (pathParams) {
    // Replace path parameters in the URL with their corresponding values
    url = url.replace(paramRegex, (_, key: string) => {
      if (!(key in pathParams)) {
        throw new Error(`Missing path param: ${key}`);
      }
      return safeEncodeURIComponent(String(pathParams[key as keyof typeof pathParams]));
    });
  }
  return url;
}

export function apiOptions<
  TManualData = never,
  TApiPath extends MaybeApiPath = MaybeApiPath,
  TActualData = [TApiPath] extends [ApiPath] ? ApiMapping[TApiPath] : TManualData,
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
    ...((path
      ? [
          {
            path: pathParams,
          },
        ]
      : []) as OptionalPathParams<TApiPath>)
  );

  return queryOptions({
    queryKey:
      Object.keys(options).length > 0 ? ([url, options] as const) : ([url] as const),
    queryFn: fetchDataQuery<TActualData>,
    staleTime,
    select: selectContent,
  });
}

apiOptions.ReturnType =
  <TManualData>() =>
  <TApiPath extends MaybeApiPath = MaybeApiPath>(
    path: TApiPath,
    options: Options & PathParamOptions<TApiPath>
  ) =>
    apiOptions<TManualData, TApiPath>(path, options as never);
