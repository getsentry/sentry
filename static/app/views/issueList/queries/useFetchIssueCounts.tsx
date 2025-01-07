import type {PageFilters} from 'sentry/types/core';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {QueryCounts} from 'sentry/views/issueList/utils';

// Copied from CountEndpointParams in overview.tsx
interface FetchIssueCountsParameters extends Partial<PageFilters['datetime']> {
  environment: string[];
  orgSlug: string;
  project: number[];
  query: string[];
  end?: string | null;
  groupStatsPeriod?: string | null;
  sort?: string;
  start?: string | null;
  statsPeriod?: string | null;
  useGroupSnubaDataset?: boolean;
}

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
