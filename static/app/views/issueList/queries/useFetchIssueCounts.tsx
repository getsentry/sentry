import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';

interface FetchIssueCountsParameters {
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
    query: requestParams,
  },
];

export const useFetchIssueCounts = (
  params: FetchIssueCountsParameters,
  options: Partial<UseApiQueryOptions<Record<string, number>>> = {}
) => {
  return useApiQuery<Record<string, number>>(makeFetchIssueCounts(params), {
    staleTime: 180000, // 3 minutes
    placeholderData: keepPreviousData,
    ...options,
  });
};
