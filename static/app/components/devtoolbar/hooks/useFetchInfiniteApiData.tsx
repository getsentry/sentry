import type {UseInfiniteQueryOptions} from '@tanstack/react-query';
import {useInfiniteQuery} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchInfiniteApiData<
  QueryFnData,
  SelectFnData = ApiResult<QueryFnData>,
>(
  props: UseInfiniteQueryOptions<
    ApiResult<QueryFnData>,
    Error,
    SelectFnData,
    ApiResult<QueryFnData>,
    ApiEndpointQueryKey
  >
) {
  const {fetchInfiniteFn, getNextPageParam, getPreviousPageParam} = useApiEndpoint();

  const infiniteQueryResult = useInfiniteQuery<
    ApiEndpointQueryKey,
    Error,
    SelectFnData,
    any
  >({
    queryFn: fetchInfiniteFn<QueryFnData>,
    getNextPageParam,
    getPreviousPageParam,
    ...props,
  });

  return infiniteQueryResult;
}
