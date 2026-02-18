import type {QueryFunctionContext} from 'sentry/utils/queryClient';
import {QUERY_API_CLIENT, type ApiQueryKey} from 'sentry/utils/queryClient';

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
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TData>> {
  const [url, opts] = context.queryKey;

  const [json, _, response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    host: opts?.host,
    method: opts?.method ?? 'GET',
    data: opts?.data,
    query: opts?.query,
    headers: opts?.headers,
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
