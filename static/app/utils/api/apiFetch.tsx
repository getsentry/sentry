import {useEffect} from 'react';
import type {QueryFunctionContext, UseInfiniteQueryResult} from '@tanstack/react-query';

import type {ResponseMeta} from 'sentry/types/api';
import type {ApiQueryKey, InfiniteApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';

export type ApiResponse<TResponseData = unknown> = {
  headers: {
    Link?: string;
    'X-Hits'?: number;
    'X-Max-Hits'?: number;
    'X-Sentry-Direct-Hit'?: string;
    /**
     * Not an HTTP header, but carried alongside them so callers can reach the
     * status code without re-plumbing the whole response object. Endpoints that
     * return more than one success code (201 created vs 200 already-exists)
     * need it to tell the cases apart.
     */
    status?: number;
  };
  json: TResponseData;
};

function extractHeaders(response: ResponseMeta | undefined): ApiResponse['headers'] {
  const hits = response?.getResponseHeader('X-Hits');
  const maxHits = response?.getResponseHeader('X-Max-Hits');
  return {
    Link: response?.getResponseHeader('Link') ?? undefined,
    'X-Hits': typeof hits === 'string' ? Number(hits) : undefined,
    'X-Max-Hits': typeof maxHits === 'string' ? Number(maxHits) : undefined,
    'X-Sentry-Direct-Hit':
      response?.getResponseHeader('X-Sentry-Direct-Hit') ?? undefined,
    status: response?.status,
  };
}

export async function apiFetch<TQueryFnData = unknown>(
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TQueryFnData>> {
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

  return {headers: extractHeaders(response), json: json as TQueryFnData};
}

export async function apiFetchInfinite<TQueryFnData = unknown>(
  context: QueryFunctionContext<InfiniteApiQueryKey, null | undefined | ParsedHeader>
): Promise<ApiResponse<TQueryFnData>> {
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

  return {headers: extractHeaders(response), json: json as TQueryFnData};
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
