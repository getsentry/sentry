import {useMemo} from 'react';
import {stringifyUrl} from 'query-string';

import parseLinkHeader, {type ParsedHeader} from 'sentry/utils/parseLinkHeader';

import type {ApiQueryKey, ApiResult} from '../types';

import useConfiguration from './useConfiguration';

function parsePageParam(dir: 'previous' | 'next') {
  return ({headers}) => {
    const parsed = parseLinkHeader(headers?.get('Link') ?? null);
    return parsed[dir]?.results ? parsed[dir] : null;
  };
}

const getNextPageParam = parsePageParam('next');
const getPreviousPageParam = parsePageParam('previous');

interface FetchParams {
  queryKey: ApiQueryKey;
}

interface InfiniteFetchParams extends FetchParams {
  pageParam?: ParsedHeader; // TODO: is this really optional?
}

export default function useApiEndpoint() {
  const {apiPrefix} = useConfiguration();

  const fetchFn = useMemo(
    () =>
      async <Data,>({
        queryKey: [endpoint, options],
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
        queryKey: [endpoint, options],
        pageParam,
      }: InfiniteFetchParams): Promise<ApiResult<Data>> => {
        const query = {
          ...options?.query,
          cursor: pageParam?.cursor,
        };
        return fetchFn<Data>({
          queryKey: [endpoint, {...options, query}],
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
