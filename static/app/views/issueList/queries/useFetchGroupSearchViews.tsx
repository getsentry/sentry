import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {
  GroupSearchView,
  GroupSearchViewVisibility,
} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
  cursor?: string;
  limit?: number;
  visibility?: GroupSearchViewVisibility;
};

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
  visibility,
  limit,
  cursor,
}: FetchGroupSearchViewsParameters): ApiQueryKey =>
  [
    `/organizations/${orgSlug}/group-search-views/`,
    {
      query: {
        per_page: limit,
        visibility,
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
