import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
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

type DateRange =
  | {
      end: string | undefined;
      start: string | undefined;
    }
  | {
      statsPeriod: string | null | undefined;
    };

export function usePerformanceUsageStats({
  organization,
  dateRange,
  projectIds,
}: {
  dateRange: DateRange;
  organization: Organization;
  projectIds: number[] | undefined;
}) {
  const statsPeriod = 'statsPeriod' in dateRange ? dateRange.statsPeriod : undefined;
  const {start, end} = 'start' in dateRange ? dateRange : {};
  const pathname = `/organizations/${organization.slug}/stats_v2/`;

  const endpointOptions = {
    query: {
      start,
      end,
      statsPeriod,
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
