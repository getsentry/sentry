import {useEffect} from 'react';
import type {QueryFunctionContext, UseInfiniteQueryResult} from '@tanstack/react-query';

import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ApiQueryKey, InfiniteApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';

export type ApiResponse<TResponseData = unknown> = {
  headers: {
    Link: string | undefined;
    'X-Hits': number | undefined;
    'X-Max-Hits': number | undefined;
  };
  json: TResponseData;
};

export async function apiFetch<TQueryFnData = unknown>(
  context: QueryFunctionContext<ApiQueryKey, never>
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

  const hits = response?.getResponseHeader('X-Hits');
  const maxHits = response?.getResponseHeader('X-Max-Hits');
  return {
    headers: {
      Link: response?.getResponseHeader('Link') ?? undefined,
      'X-Hits': typeof hits === 'string' ? Number(hits) : undefined,
      'X-Max-Hits': typeof maxHits === 'string' ? Number(maxHits) : undefined,
    },
    json: json as TQueryFnData,
  };
}

export function useFetchAllPages<TQueryFnData = unknown>({
  result,
  enabled = true,
}: {
  result: UseInfiniteQueryResult<TQueryFnData, Error>;
  enabled?: boolean;
}) {
  const {fetchNextPage, hasNextPage, isError, isFetchingNextPage} = result;
  useEffect(() => {
    if (enabled && !isError && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [enabled, hasNextPage, fetchNextPage, isError, isFetchingNextPage]);
}
export async function apiFetchInfinite<TQueryFnData = unknown>(
  context: QueryFunctionContext<InfiniteApiQueryKey, null | undefined | ParsedHeader>
): Promise<ApiResponse<TQueryFnData>> {
  const {url, options} = parseQueryKey(context.queryKey);

  const [json, , response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    host: options?.host,
    method: options?.method ?? 'GET',
    data: options?.data,
    query: {
      ...options?.query,
      cursor: context.pageParam?.cursor ?? options?.query?.cursor,
    },
    headers: options?.headers,
  });

  const hits = response?.getResponseHeader('X-Hits');
  const maxHits = response?.getResponseHeader('X-Max-Hits');
  return {
    headers: {
      Link: response?.getResponseHeader('Link') ?? undefined,
      'X-Hits': typeof hits === 'string' ? Number(hits) : undefined,
      'X-Max-Hits': typeof maxHits === 'string' ? Number(maxHits) : undefined,
    },
    json: json as TQueryFnData,
  };
}
