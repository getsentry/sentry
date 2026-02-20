import type {QueryFunctionContext} from '@tanstack/react-query';

import type {ApiQueryKey, InfiniteApiQueryKey} from 'sentry/utils/queryClient';
import {parseQueryKey, QUERY_API_CLIENT} from 'sentry/utils/queryClient';

export type ApiResponse<TResponseData = unknown> = {
  headers: {
    Link: string | undefined;
    'X-Hits': number | undefined;
    'X-Max-Hits': number | undefined;
  };
  json: TResponseData;
};

export default async function apiFetch<TQueryFnData = unknown>(
  context: QueryFunctionContext<ApiQueryKey | InfiniteApiQueryKey>
): Promise<ApiResponse<TQueryFnData>> {
  const {url = '', options = {}} = parseQueryKey(context.queryKey);

  const [json, _, response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    host: options?.host,
    method: options?.method ?? 'GET',
    data: options?.data,
    query: options?.query,
    headers: options?.headers,
  });

  const xhits = response!.getResponseHeader('X-Hits');
  const xmaxhits = response!.getResponseHeader('X-Max-Hits');
  return {
    headers: {
      Link: response!.getResponseHeader('Link') ?? undefined,
      'X-Hits': xhits === null ? undefined : parseInt(xhits, 10),
      'X-Max-Hits': xmaxhits === null ? undefined : parseInt(xmaxhits, 10),
    },
    json: json as TQueryFnData,
  };
}
