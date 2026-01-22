import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {
  GroupSearchView,
  GroupSearchViewCreatedBy,
} from 'sentry/views/issueList/types';

export type GroupSearchViewBackendSortOption =
  | 'visited'
  | '-visited'
  | 'popularity'
  | '-popularity'
  | 'name'
  | '-name'
  | 'created'
  | '-created';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
  createdBy?: GroupSearchViewCreatedBy;
  cursor?: string;
  limit?: number;
  query?: string;
  sort?: GroupSearchViewBackendSortOption[];
};

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
  createdBy,
  limit,
  cursor,
  sort,
  query,
}: FetchGroupSearchViewsParameters): ApiQueryKey =>
  [
    getApiUrl('/organizations/$organizationIdOrSlug/group-search-views/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {
      query: {
        per_page: limit,
        createdBy,
        cursor,
        sort,
        query,
      },
    },
  ] as const;

export const useFetchGroupSearchViews = (
  parameters: FetchGroupSearchViewsParameters,
  options: Partial<UseApiQueryOptions<GroupSearchView[]>> = {}
) => {
  return useApiQuery<GroupSearchView[]>(makeFetchGroupSearchViewsKey(parameters), {
    staleTime: Infinity,
    ...options,
  });
};
