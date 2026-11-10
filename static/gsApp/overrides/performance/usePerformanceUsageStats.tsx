import {useQuery} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {PageFilters, PageFilterDatetime} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type PerformanceStatsGroup = {
  by: {
    reason: string;
  };
  totals: {
    'sum(quantity)': number;
  };
};

type PartialUsageStats = {
  groups?: PerformanceStatsGroup[];
};

export function usePerformanceUsageStats({
  organization,
  dateRange,
  projectIds,
}: {
  dateRange: PageFilterDatetime;
  organization: Organization;
  projectIds: PageFilters['projects'];
}) {
  const {start, end, period} = dateRange;

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

  const {data} = useQuery(
    apiOptions.as<PartialUsageStats>()('/organizations/$organizationIdOrSlug/stats_v2/', {
      path: {organizationIdOrSlug: organization.slug},
      ...endpointOptions,
      staleTime: Infinity,
    })
  );

  return {
    data: data?.groups?.find(group =>
      [
        'transaction_usage_exceeded',
        'span_usage_exceeded',
        'log_bytes_usage_exceeded',
      ].includes(group.by.reason)
    ),
  };
}
