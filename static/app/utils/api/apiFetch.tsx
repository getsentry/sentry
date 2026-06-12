import {useEffect} from 'react';
import type {QueryFunctionContext, UseInfiniteQueryResult} from '@tanstack/react-query';

import {ConfigStore} from 'sentry/stores/configStore';
import type {ApiQueryKey, InfiniteApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {sentryCellFetch, sentryCellFetchInfinite} from 'sentry/utils/api/sentryCellFetch';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';

export type ApiResponse<TResponseData = unknown> = {
  headers: {
    Link?: string;
    'X-Hits'?: number;
    'X-Max-Hits'?: number;
  };
  json: TResponseData;
};

export async function apiFetch<TQueryFnData = unknown>(
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TQueryFnData>> {
  const systemFeatures = ConfigStore.get('features');
  const isCellFetchEnabled = systemFeatures.has('organizations:api-fetch-v2');
  if (isCellFetchEnabled) {
    return sentryCellFetch(context);
  }

  const [url, options] = context.queryKey;

  const [json, , response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    allowAuthError: options?.allowAuthError,
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

export async function apiFetchInfinite<TQueryFnData = unknown>(
  context: QueryFunctionContext<InfiniteApiQueryKey, null | undefined | ParsedHeader>
): Promise<ApiResponse<TQueryFnData>> {
  const systemFeatures = ConfigStore.get('features');
  const isCellFetchEnabled = systemFeatures.has('organizations:api-fetch-v2');
  if (isCellFetchEnabled) {
    return sentryCellFetchInfinite(context);
  }

  const [url, options] = context.queryKey;

  const [json, , response] = await QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: true,
    allowAuthError: options?.allowAuthError,
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

export function useFetchAllPages<TQueryFnData = unknown>({
  result,
  enabled = true,
}: {
  result: UseInfiniteQueryResult<TQueryFnData>;
  enabled?: boolean;
}) {
  const {fetchNextPage, hasNextPage, isError, isFetchingNextPage} = result;
  useEffect(() => {
    if (enabled && !isError && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [enabled, hasNextPage, fetchNextPage, isError, isFetchingNextPage]);
}
