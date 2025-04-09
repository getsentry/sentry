import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {
  GroupSearchView,
  GroupSearchViewCreatedBy,
  GroupSearchViewSort,
} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
  createdBy?: GroupSearchViewCreatedBy;
  cursor?: string;
  limit?: number;
  sort?: GroupSearchViewSort;
};

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
  createdBy,
  limit,
  cursor,
  sort,
}: FetchGroupSearchViewsParameters): ApiQueryKey =>
  [
    `/organizations/${orgSlug}/group-search-views/`,
    {
      query: {
        per_page: limit,
        createdBy,
        cursor,
        sort,
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
