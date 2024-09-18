import type {UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

export default function useFetchApiData<
  QueryFnData,
  SelectFnData = ApiResult<QueryFnData>,
>(
  props: UseQueryOptions<ApiResult<QueryFnData>, Error, SelectFnData, ApiEndpointQueryKey>
) {
  const {fetchFn} = useApiEndpoint();

  const infiniteQueryResult = useQuery({
    queryFn: fetchFn<QueryFnData>,
    ...props,
  });

  return infiniteQueryResult;
}
