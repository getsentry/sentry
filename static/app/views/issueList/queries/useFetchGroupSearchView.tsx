import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  id: string | number;
  orgSlug: string;
};

export const makeFetchGroupSearchViewKey = ({
  id,
  orgSlug,
}: FetchGroupSearchViewsParameters): ApiQueryKey => [
  getApiUrl(`/organizations/$organizationIdOrSlug/group-search-views/$viewId/`, {
    path: {organizationIdOrSlug: orgSlug, viewId: id},
  }),
];

export const useFetchGroupSearchView = (
  parameters: FetchGroupSearchViewsParameters,
  options: Partial<UseApiQueryOptions<GroupSearchView>> = {}
) => {
  return useApiQuery<GroupSearchView>(makeFetchGroupSearchViewKey(parameters), {
    staleTime: 0,
    retry: false,
    ...options,
  });
};
