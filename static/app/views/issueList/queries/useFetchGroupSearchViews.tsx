import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {GroupSearchViewResponse} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
};

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
}: FetchGroupSearchViewsParameters) =>
  [`/organizations/${orgSlug}/group-search-views/`] as const;

export const useFetchGroupSearchViews = (
  {orgSlug}: FetchGroupSearchViewsParameters,
  options: Partial<UseApiQueryOptions<GroupSearchViewResponse[]>> = {}
) => {
  return useApiQuery<GroupSearchViewResponse[]>(makeFetchGroupSearchViewsKey({orgSlug}), {
    staleTime: Infinity,
    ...options,
  });
};
