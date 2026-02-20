import type {QueryFunctionContext} from '@tanstack/react-query';

import type {ApiQueryKey} from 'sentry/utils/queryClient';
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
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TQueryFnData>> {
  const {url, options} = parseQueryKey(context.queryKey);

  const [json, , response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    host: options?.host,
    method: options?.method ?? 'GET',
    data: options?.data,
    query: options?.query,
    headers: options?.headers,
  });

  const xhits = response!.getResponseHeader('X-Hits') ?? null;
  const xmaxhits = response!.getResponseHeader('X-Max-Hits') ?? null;
  return {
    headers: {
      Link: response!.getResponseHeader('Link') ?? undefined,
      'X-Hits': xhits === null ? undefined : Number(xhits),
      'X-Max-Hits': xmaxhits === null ? undefined : Number(xmaxhits),
    },
    json: json as TQueryFnData,
  };
}
