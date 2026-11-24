import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';

interface FetchIssueCountsParameters {
  environment: string[];
  orgSlug: string;
  project: number[];
  query: string[];
  end?: string | null;
  start?: string | null;
  statsPeriod?: string | null;
}

const fetchIssueCountsOptions = ({
  orgSlug,
  ...requestParams
}: FetchIssueCountsParameters) =>
  apiOptions.as<Record<string, number>>()(
    '/organizations/$organizationIdOrSlug/issues-count/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: requestParams,
      staleTime: 180000, // 3 minutes
    }
  );

export const useFetchIssueCounts = (params: FetchIssueCountsParameters) => {
  return useQuery({
    ...fetchIssueCountsOptions(params),
    placeholderData: keepPreviousData,
  });
};
