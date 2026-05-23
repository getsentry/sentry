import type {QueryFunctionContext} from '@tanstack/react-query';

import {Client} from 'sentry/api';
import type {
  ApiQueryKey,
  InfiniteApiQueryKey,
  QueryKeyEndpointOptions,
} from 'sentry/utils/api/apiQueryKey';
import type {ApiResponse, SentryCellFetchConfig} from 'sentry/utils/api/sentryCellFetch';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';

const mockClient = new Client();

export function configureSentryCellFetch(_config: SentryCellFetchConfig): void {
  // no-op in tests
}

function buildApiResponse<T>(
  json: T,
  response: {getResponseHeader?: (key: string) => string | null} | undefined
): ApiResponse<T> {
  const hits = response?.getResponseHeader?.('X-Hits');
  const maxHits = response?.getResponseHeader?.('X-Max-Hits');
  return {
    headers: {
      Link: response?.getResponseHeader?.('Link') ?? undefined,
      'X-Hits': typeof hits === 'string' ? Number(hits) : undefined,
      'X-Max-Hits': typeof maxHits === 'string' ? Number(maxHits) : undefined,
    },
    json,
  };
}

export async function fetchWithUrl<TQueryFnData = unknown>(
  url: string,
  options: QueryKeyEndpointOptions = {}
): Promise<ApiResponse<TQueryFnData>> {
  const [json, , response] = await mockClient.requestPromise(url, {
    includeAllArgs: true,
    allowAuthError: options.allowAuthError,
    host: options.host,
    method: options.method ?? 'GET',
    data: options.data,
    query: options.query,
    headers: options.headers,
  });

  return buildApiResponse(json as TQueryFnData, response);
}

export async function sentryCellFetch<TQueryFnData = unknown>(
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TQueryFnData>> {
  const [url, options] = context.queryKey;
  return fetchWithUrl(url, options);
}

export async function sentryCellFetchInfinite<TQueryFnData = unknown>(
  context: QueryFunctionContext<InfiniteApiQueryKey, null | undefined | ParsedHeader>
): Promise<ApiResponse<TQueryFnData>> {
  const [url, options] = context.queryKey;
  return fetchWithUrl(url, {
    ...options,
    query: {
      ...options?.query,
      cursor: context.pageParam?.cursor ?? options?.query?.cursor,
    },
  });
}
