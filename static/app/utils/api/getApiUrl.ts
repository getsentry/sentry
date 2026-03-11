import {skipToken} from '@tanstack/react-query';
import type {SkipToken} from '@tanstack/react-query';

import type {KnownGetsentryApiUrls} from 'sentry/utils/api/knownGetsentryApiUrls';
import type {KnownSentryApiUrls} from 'sentry/utils/api/knownSentryApiUrls.generated';

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type StripDollar<T extends string> = T extends `$${infer Name}` ? Name : T;

type SplitColon<T extends string> = T extends `${infer A}:${infer B}`
  ? StripDollar<A> | SplitColon<B>
  : StripDollar<T>;

export type ExtractPathParams<TApiPath extends string> =
  TApiPath extends `${string}$${infer Param}/${infer Rest}`
    ? SplitColon<Param> | ExtractPathParams<`/${Rest}`>
    : TApiPath extends `${string}$${infer Param}`
      ? SplitColon<Param>
      : never;

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number> | SkipToken};

export type OptionalPathParams<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never ? never[] : [PathParamOptions<TApiPath>];

const paramRegex = /\$([a-zA-Z0-9_-]+)/g;

type ApiUrl = string & {__apiUrl: true};

export default function getApiUrl<TApiPath extends KnownApiUrls = KnownApiUrls>(
  path: TApiPath,
  ...[options]: OptionalPathParams<TApiPath>
): ApiUrl {
  let url: string = path;
  const pathParams = options?.path;
  if (pathParams === skipToken) {
    return url as ApiUrl;
  }
  if (pathParams) {
    // Replace path parameters in the URL with their corresponding values
    url = url.replace(paramRegex, (_, key: string) => {
      if (!(key in pathParams)) {
        throw new Error(`Missing path param: ${key}`);
      }
      return encodeURIComponent(String(pathParams[key as keyof typeof pathParams]));
    });
  }
  return url as ApiUrl;
}
