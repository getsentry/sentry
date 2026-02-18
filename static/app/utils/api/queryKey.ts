import type {SkipToken} from '@tanstack/react-query';
import {skipToken} from '@tanstack/react-query';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ExtractPathParams, OptionalPathParams} from 'sentry/utils/api/getApiUrl';
import type {KnownGetsentryApiUrls} from 'sentry/utils/api/knownGetsentryApiUrls';
import type {KnownSentryApiUrls} from 'sentry/utils/api/knownSentryApiUrls.generated';

export type QueryKeyEndpointOptions<
  Headers = Record<string, string>,
  Query = Record<string, any>,
  Data = Record<string, any>,
> = {
  data?: Data;
  headers?: Headers;
  host?: string;
  method?: 'POST' | 'GET' | 'DELETE' | 'PUT';
  query?: Query;
};

export type ApiQueryKey =
  | readonly [url: ReturnType<typeof getApiUrl>]
  | readonly [
      url: ReturnType<typeof getApiUrl>,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];
export type InfiniteApiQueryKey =
  | readonly ['infinite', url: ReturnType<typeof getApiUrl>]
  | readonly [
      'infinite',
      url: ReturnType<typeof getApiUrl>,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];

type KnownApiUrls = KnownGetsentryApiUrls | KnownSentryApiUrls;

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? undefined
    : Record<ExtractPathParams<TApiPath>, string | number> | SkipToken;

interface Options<TApiPath extends KnownApiUrls> extends QueryKeyEndpointOptions {
  path?: PathParamOptions<TApiPath>;
}

export function getQueryKey<TApiPath extends KnownApiUrls = KnownApiUrls>(
  template: TApiPath,
  options?: Options<TApiPath>
): ApiQueryKey {
  const {path, ...endpointOptions} = options ?? {};

  // If you pass in skipToken as the path, we return the template as the url
  // This url should not be used to make a request, it is only used to identify
  // the query key. You should be disabling the queryFn or passing enabled:false
  // at the same time.
  const url =
    path === skipToken
      ? (template as ReturnType<typeof getApiUrl>)
      : getApiUrl<TApiPath>(template, ...([{path}] as OptionalPathParams<TApiPath>));
  return endpointOptions && Object.keys(endpointOptions).length > 0
    ? ([url, endpointOptions] as const)
    : ([url] as const);
}

export function getInfiniteQueryKey<TApiPath extends KnownApiUrls = KnownApiUrls>(
  template: TApiPath,
  options?: Options<TApiPath>
): InfiniteApiQueryKey {
  return ['infinite', ...getQueryKey<TApiPath>(template, options ?? {})] as const;
}
