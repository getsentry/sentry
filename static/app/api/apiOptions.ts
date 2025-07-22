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
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number>};

type Options<TApiPath extends string> = PathParamOptions<TApiPath> &
  QueryKeyEndpointOptions & {staleTime: number};

const paramRegex = /\$([a-zA-Z0-9_-]+)/g;

const selectContent = <TData>(data: {content: TData}) => data.content;

export function apiOptions<
  TManualData = never,
  TApiPath extends MaybeApiPath = MaybeApiPath,
  TActualData = [TApiPath] extends [ApiPath] ? ApiMapping[TApiPath] : TManualData,
>(path: TApiPath, {staleTime, path: pathParams, ...options}: Options<TApiPath>) {
  let url: string = path;
  if (pathParams) {
    // Replace path parameters in the URL with their corresponding values
    url = url.replace(paramRegex, (_, key: string) => {
      if (!(key in pathParams)) {
        throw new Error(`Missing path param: ${key}`);
      }
      return safeEncodeURIComponent(String(pathParams[key as keyof typeof pathParams]));
    });
  }

  return queryOptions({
    queryKey:
      Object.keys(options).length > 0 ? ([url, options] as const) : ([url] as const),
    queryFn: async ctx => {
      const response = await fetchDataQuery<TActualData>(ctx);

      return {content: response[0], headers: response[2]?.headers} as const;
    },
    staleTime,
    select: selectContent,
  });
}

apiOptions.ReturnType =
  <TManualData>() =>
  <TApiPath extends MaybeApiPath = MaybeApiPath>(
    path: TApiPath,
    options: Options<TApiPath>
  ) =>
    apiOptions<TManualData, TApiPath>(path, options);
