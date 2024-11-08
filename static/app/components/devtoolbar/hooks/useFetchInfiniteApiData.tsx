import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint, {type PageParam} from './useApiEndpoint';

export default function useFetchInfiniteApiData<Data>(
  props: Omit<
    UseInfiniteQueryOptions<
      ApiResult<Data>,
      Error,
      InfiniteData<ApiResult<Data>>,
      // TQueryData Not sure what this one should be
      any,
      ApiEndpointQueryKey,
      PageParam
    >,
    'getNextPageParam' | 'getPreviousPageParam' | 'queryFn' | 'initialPageParam' | 'query'
  >
) {
  const {fetchInfiniteFn, getNextPageParam, getPreviousPageParam} = useApiEndpoint();

  const infiniteQueryResult = useInfiniteQuery<
    ApiResult<Data>,
    Error,
    InfiniteData<ApiResult<Data>>,
    ApiEndpointQueryKey,
    PageParam
  >({
    queryFn: fetchInfiniteFn<Data>,
    getNextPageParam,
    getPreviousPageParam,
    initialPageParam: undefined,
    ...props,
  });

  return infiniteQueryResult;
}
