import type {UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchApiData<Data extends Array<unknown>>(
  props: UseQueryOptions<ApiEndpointQueryKey, Error, Data, ApiEndpointQueryKey>
) {
  const {fetchFn} = useApiEndpoint();

  const infiniteQueryResult = useQuery<ApiEndpointQueryKey, Error, ApiResult<Data>, any>({
    queryFn: fetchFn<Data>,
    ...props,
  });

  return infiniteQueryResult;
}
