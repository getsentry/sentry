import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
};

type FetchGroupSearchViewsResponse = GroupSearchView[];

export const makeFetchGroupSearchViewsKey = ({
  orgSlug,
}: FetchGroupSearchViewsParameters) =>
  [`/organizations/${orgSlug}/group-search-views/`] as const;

export const useFetchGroupSearchViewsForOrg = (
  {orgSlug}: FetchGroupSearchViewsParameters,
  options: Partial<UseApiQueryOptions<FetchGroupSearchViewsResponse>> = {}
) => {
  return useApiQuery<FetchGroupSearchViewsResponse>(
    makeFetchGroupSearchViewsKey({orgSlug}),
    {
      staleTime: Infinity,
      ...options,
    }
  );
};
