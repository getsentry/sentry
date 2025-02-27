import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

export type PerformanceStatsGroup = {
  by: {
    reason: string;
  };
  totals: {
    'sum(quantity)': number;
  };
};

type PartialUsageStats = {
  groups: PerformanceStatsGroup[];
};

export function usePerformanceUsageStats({
  organization,
  dateRange,
  projectIds,
}: {
  dateRange: PageFilters['datetime'];
  organization: Organization;
  projectIds: PageFilters['projects'];
}) {
  const {start, end, period} = dateRange;
  const pathname = `/organizations/${organization.slug}/stats_v2/`;

  const endpointOptions = {
    query: {
      start,
      end,
      statsPeriod: period,
      interval: '1h',
      groupBy: ['outcome', 'reason'],
      field: 'sum(quantity)',
      utc: true,
      category: 'transaction_indexed',
      project: projectIds ?? ALL_ACCESS_PROJECTS,
      referrer: 'trace-view-warnings',
    },
  };

  const results = useApiQuery<PartialUsageStats>([pathname, endpointOptions], {
    staleTime: Infinity,
  });

  return {
    ...results,
    data: results.data?.groups.find(group =>
      ['transaction_usage_exceeded', 'span_usage_exceeded'].includes(group.by.reason)
    ),
  };
}
