import type {UseQueryOptions, UseQueryResult} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {ApiEndpointQueryKey, ApiResult} from '../types';

import useApiEndpoint from './useApiEndpoint';

/**
 * isLoading is renamed to isPending in v5, this backports the type to v4
 *
 * TODO(react-query): Remove this when we upgrade to react-query v5
 *
 * @link https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5
 */
type BackportIsPending<T> = T extends {isLoading: boolean}
  ? T & {isPending: T['isLoading']}
  : T;

export default function useFetchApiData<
  QueryFnData,
  SelectFnData = ApiResult<QueryFnData>,
>(
  props: UseQueryOptions<ApiResult<QueryFnData>, Error, SelectFnData, ApiEndpointQueryKey>
) {
  const {fetchFn} = useApiEndpoint();

  const infiniteQueryResult = useQuery<ApiEndpointQueryKey, Error, SelectFnData, any>({
    queryFn: fetchFn<QueryFnData>,
    ...props,
  });

  // TODO(react-query): Remove this when we upgrade to react-query v5
  // @ts-expect-error: This is a backport of react-query v5
  infiniteQueryResult.isPending = infiniteQueryResult.isLoading;

  // TODO(react-query): Remove casting when we upgrade to react-query v5
  return infiniteQueryResult as BackportIsPending<UseQueryResult<SelectFnData, Error>>;
}
