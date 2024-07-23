import type {UseInfiniteQueryOptions} from '@tanstack/react-query';
import {useInfiniteQuery} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchInfiniteApiData<Data extends Array<unknown>>(
  props: UseInfiniteQueryOptions<ApiEndpointQueryKey, Error, ApiResult<Data>, any>
) {
  const {fetchInfiniteFn, getNextPageParam, getPreviousPageParam} = useApiEndpoint();

  const infiniteQueryResult = useInfiniteQuery<
    ApiEndpointQueryKey,
    Error,
    ApiResult<Data>,
    any
  >({
    queryFn: fetchInfiniteFn<Data>,
    getNextPageParam,
    getPreviousPageParam,
    ...props,
  });

  return infiniteQueryResult;
}
