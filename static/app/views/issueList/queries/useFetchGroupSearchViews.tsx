import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {
  GroupSearchView,
  GroupSearchViewCreatedBy,
} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
  createdBy?: GroupSearchViewCreatedBy;
  cursor?: string;
  limit?: number;
};

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
  createdBy,
  limit,
  cursor,
}: FetchGroupSearchViewsParameters): ApiQueryKey =>
  [
    `/organizations/${orgSlug}/group-search-views/`,
    {
      query: {
        per_page: limit,
        createdBy,
        cursor,
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
