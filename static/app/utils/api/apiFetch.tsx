import type {QueryFunctionContext} from '@tanstack/react-query';

import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ApiQueryKey, InfiniteApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';

export type ApiResponse<TResponseData = unknown> = {
  headers: {
    Endpoint: string | undefined;
    Link: string | undefined;
    'X-Hits': string | undefined;
    'X-Max-Hits': string | undefined;
  };
  json: TResponseData;
};

export default async function apiFetch<TData = unknown>(
  context: QueryFunctionContext<ApiQueryKey | InfiniteApiQueryKey>
): Promise<ApiResponse<TData>> {
  const {url, options = {}} = parseQueryKey(context.queryKey);

  const [json, _, response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    host: options?.host,
    method: options?.method ?? 'GET',
    data: options?.data,
    query: options?.query,
    headers: options?.headers,
  });

  return {
    headers: {
      Endpoint: response!.getResponseHeader('Endpoint') ?? undefined,
      Link: response!.getResponseHeader('Link') ?? undefined,
      'X-Hits': response!.getResponseHeader('X-Hits') ?? undefined,
      'X-Max-Hits': response!.getResponseHeader('X-Max-Hits') ?? undefined,
    },
    json: json as TData,
  };
}
