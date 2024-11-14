import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
};

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
}: FetchGroupSearchViewsParameters) =>
  [`/organizations/${orgSlug}/group-search-views/`] as const;

export const useFetchGroupSearchViews = (
  {orgSlug}: FetchGroupSearchViewsParameters,
  options: Partial<UseApiQueryOptions<GroupSearchView[]>> = {}
) => {
  return useApiQuery<GroupSearchView[]>(makeFetchGroupSearchViewsKey({orgSlug}), {
    staleTime: Infinity,
    ...options,
  });
};
