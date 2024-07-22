import {useInfiniteQuery} from '@tanstack/react-query';

import type {ApiQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

interface Props {
  queryKey: ApiQueryKey;
}

export default function useFetchInfiniteApiData<Data extends Array<unknown>>({
  queryKey,
}: Props) {
  const {fetchInfiniteFn, getNextPageParam, getPreviousPageParam} = useApiEndpoint();

  const infiniteQueryResult = useInfiniteQuery<ApiQueryKey, Error, ApiResult<Data>, any>({
    queryKey,
    queryFn: fetchInfiniteFn<Data>,
    getNextPageParam,
    getPreviousPageParam,
  });

  return infiniteQueryResult;
}
