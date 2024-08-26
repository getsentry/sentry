import {useMemo} from 'react';
import {stringifyUrl} from 'query-string';

import parseLinkHeader, {type ParsedHeader} from 'sentry/utils/parseLinkHeader';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useConfiguration from './useConfiguration';

function parsePageParam<Data>(dir: 'previous' | 'next') {
  return ({headers}: ApiResult<Data>) => {
    const parsed = parseLinkHeader(headers?.get('Link') ?? null);
    return parsed[dir]?.results ? parsed[dir] : null;
  };
}

const getNextPageParam = parsePageParam('next');
const getPreviousPageParam = parsePageParam('previous');

interface FetchParams {
  queryKey: ApiEndpointQueryKey;
}

interface InfiniteFetchParams extends FetchParams {
  pageParam: ParsedHeader;
}

export default function useApiEndpoint() {
  const {apiPrefix} = useConfiguration();

  const fetchFn = useMemo(
    () =>
      async <Data,>({
        queryKey: [_ns, endpoint, options],
      }: FetchParams): Promise<ApiResult<Data>> => {
        const response = await fetch(
          stringifyUrl({url: apiPrefix + endpoint, query: options?.query}),
          {
            body: options?.payload ? JSON.stringify(options?.payload) : undefined,
            headers: options?.headers,
            method: options?.method ?? 'GET',
          }
        );

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        return {
          json: await response.json(),
          headers: response.headers,
        };
      },
    [apiPrefix]
  );

  const fetchInfiniteFn = useMemo(
    () =>
      <Data,>({
        queryKey: [ns, endpoint, options],
        pageParam,
      }: InfiniteFetchParams): Promise<ApiResult<Data>> => {
        const query = {
          ...options?.query,
          cursor: pageParam?.cursor,
        };
        return fetchFn<Data>({
          queryKey: [ns, endpoint, {...options, query}],
        });
      },
    [fetchFn]
  );

  return {
    fetchFn,
    fetchInfiniteFn,
    getNextPageParam,
    getPreviousPageParam,
  };
}
