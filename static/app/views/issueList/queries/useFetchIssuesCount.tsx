import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {QueryCounts} from 'sentry/views/issueList/utils';

// Copied from CountEndpointParams in overview.tsx
type FetchIssueCountsParameters = {
  environment: string[];
  orgSlug: string;
  project: number[];
  query: string[];
  groupStatsPeriod?: string | null;
  sort?: string;
  statsPeriod?: string | null;
  useGroupSnubaDataset?: boolean;
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

export const useFetchIssueCounts = (
  params: FetchIssueCountsParameters,
  options: Partial<UseApiQueryOptions<QueryCounts>> = {}
) => {
  return useApiQuery<QueryCounts>(makeFetchIssueCounts(params), {
    staleTime: 0,
    ...options,
  });
};
