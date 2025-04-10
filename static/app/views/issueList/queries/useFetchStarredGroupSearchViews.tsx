import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {StarredGroupSearchView} from 'sentry/views/issueList/types';

type FetchStarredGroupSearchViewsParameters = {
  orgSlug: string;
};

export const makeFetchStarredGroupSearchViewsKey = ({
  orgSlug,
}: FetchStarredGroupSearchViewsParameters): ApiQueryKey =>
  [`/organizations/${orgSlug}/group-search-views/starred/`, {}] as const;

export const useFetchStarredGroupSearchViews = (
  parameters: FetchStarredGroupSearchViewsParameters,
  options: Partial<UseApiQueryOptions<StarredGroupSearchView[]>> = {}
) => {
  return useApiQuery<StarredGroupSearchView[]>(
    makeFetchStarredGroupSearchViewsKey(parameters),
    {
      staleTime: Infinity,
      ...options,
    }
  );
};
