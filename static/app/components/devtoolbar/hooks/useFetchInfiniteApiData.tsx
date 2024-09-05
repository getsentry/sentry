import type {
  DefinedUseInfiniteQueryResult,
  InfiniteData,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import {useInfiniteQuery} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchInfiniteApiData<Data>(
  props: Omit<
    UseInfiniteQueryOptions<ApiEndpointQueryKey, Error, ApiResult<Data>, any>,
    'getNextPageParam' | 'getPreviousPageParam' | 'queryFn' | 'initialPageParam'
  >
): DefinedUseInfiniteQueryResult<InfiniteData<ApiResult<Data>, unknown>, Error> {
  const {fetchInfiniteFn, getNextPageParam, getPreviousPageParam} = useApiEndpoint();

  // TODO: Not sure how to get this to work with the types
  const infiniteQueryResult = useInfiniteQuery<
    ApiEndpointQueryKey,
    Error,
    ApiResult<Data>,
    any
  >({
    queryFn: fetchInfiniteFn<Data>,
    getNextPageParam,
    getPreviousPageParam,
    initialPageParam: undefined,
    ...props,
  });

  return infiniteQueryResult;
}
