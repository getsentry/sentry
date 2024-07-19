import type {UseInfiniteQueryOptions} from '@tanstack/react-query';
import {useInfiniteQuery} from '@tanstack/react-query';

import type {ApiQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchInfiniteApiData<Data extends Array<unknown>>(
  props: UseInfiniteQueryOptions<ApiQueryKey, Error, ApiResult<Data>, any>
) {
  const {fetchInfiniteFn, getNextPageParam, getPreviousPageParam} = useApiEndpoint();

  const infiniteQueryResult = useInfiniteQuery<ApiQueryKey, Error, ApiResult<Data>, any>({
    queryFn: fetchInfiniteFn<Data>,
    getNextPageParam,
    getPreviousPageParam,
    ...props,
  });

  return infiniteQueryResult;
}
