import type {UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {ApiQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchApiData<Data extends Array<unknown>>(
  props: UseQueryOptions<ApiQueryKey, Error, Data, ApiQueryKey>
) {
  const {fetchFn} = useApiEndpoint();

  const infiniteQueryResult = useQuery<ApiQueryKey, Error, ApiResult<Data>, any>({
    queryFn: fetchFn<Data>,
    ...props,
  });

  return infiniteQueryResult;
}
