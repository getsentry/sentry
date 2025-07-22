import {queryOptions} from '@tanstack/react-query';

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
    ? {pathParams?: never}
    : {pathParams: Record<ExtractPathParams<TApiPath>, string | number>};

type Options<TApiPath extends string> = PathParamOptions<TApiPath> &
  QueryKeyEndpointOptions & {staleTime: number};

export function apiOptions<
  TManualData = never,
  TApiPath extends MaybeApiPath = MaybeApiPath,
  TActualData = [TApiPath] extends [ApiPath] ? ApiMapping[TApiPath] : TManualData,
>(path: TApiPath, {staleTime, pathParams, ...options}: Options<TApiPath>) {
  let url: string = path;
  if (pathParams) {
    // Replace path parameters in the URL with their corresponding values
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(`$${key}`, safeEncodeURIComponent(String(value)));
    }
  }

  return queryOptions({
    queryKey: [url, options],
    queryFn: fetchDataQuery<TActualData>,
    staleTime,
  });
}

apiOptions.ReturnType =
  <TManualData>() =>
  <TApiPath extends MaybeApiPath = MaybeApiPath>(
    path: TApiPath,
    options: Options<TApiPath>
  ) =>
    apiOptions<TManualData, TApiPath>(path, options);
