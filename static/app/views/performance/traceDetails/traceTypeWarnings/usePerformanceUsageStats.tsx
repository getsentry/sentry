import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';

// 1 hour in milliseconds
const ONE_HOUR = 60 * 60 * 1000;

type PerformanceStatsGroup = {
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
  tree,
}: {
  organization: Organization;
  tree: TraceTree;
}) {
  const traceNode = tree.root.children[0];

  const traceStartDate = new Date(traceNode?.space?.[0]!);
  const traceEndDate = new Date(traceNode?.space?.[0]! + traceNode?.space?.[1]!);

  // Add 1 hour buffer to the trace start and end date.
  const start = traceNode
    ? new Date(traceStartDate.getTime() - ONE_HOUR).toISOString()
    : '';
  const end = traceNode ? new Date(traceEndDate.getTime() + ONE_HOUR).toISOString() : '';

  const endpointOptions = {
    query: {
      start,
      end,
      interval: '1h',
      groupBy: ['outcome', 'reason'],
      field: 'sum(quantity)',
      utc: true,
      category: 'transaction_indexed',
      project: Array.from(tree.projects.keys()),
      referrer: 'trace-view-warnings',
    },
  };

  const results = useQuery({
    ...apiOptions.as<PartialUsageStats>()(
      '/organizations/$organizationIdOrSlug/stats_v2/',
      {
        path: {organizationIdOrSlug: organization.slug},
        ...endpointOptions,
        staleTime: Infinity,
      }
    ),
    staleTime: Infinity,
    enabled: !!traceNode,
  });

  return {
    data: results.data?.groups.find(group =>
      ['transaction_usage_exceeded', 'span_usage_exceeded'].includes(group.by.reason)
    ),
  };
}
