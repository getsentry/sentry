import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {CountsEndpointParams} from 'sentry/views/issueList/overview';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type FetchIssueCountsParameters = CountsEndpointParams & {
  orgSlug: string;
};

export const makeFetchIssueCounts = ({
  orgSlug,
  ...requestParams
}: FetchIssueCountsParameters): ApiQueryKey => [
  `/organizations/${orgSlug}/issues-count/`,
  {
    query: {
      ...requestParams,
    },
  },
];

export const useFetchGroupSearchViews = (
  params: FetchIssueCountsParameters,
  options: Partial<UseApiQueryOptions<GroupSearchView[]>> = {}
) => {
  return useApiQuery<GroupSearchView[]>(makeFetchIssueCounts(params), {
    staleTime: Infinity,
    ...options,
  });
};
