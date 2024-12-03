import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {TraceTree} from '../traceModels/traceTree';

// 1 hour in milliseconds
const ONE_HOUR = 60 * 60 * 1000;

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
  tree,
}: {
  organization: Organization;
  tree: TraceTree;
}) {
  const traceNode = tree.root.children[0];

  const traceStartDate = new Date(traceNode?.space?.[0]);
  const traceEndDate = new Date(traceNode?.space?.[0] + traceNode?.space?.[1]);

  // Add 1 hour buffer to the trace start and end date.
  const start = traceNode
    ? new Date(traceStartDate.getTime() - ONE_HOUR).toISOString()
    : '';
  const end = traceNode ? new Date(traceEndDate.getTime() + ONE_HOUR).toISOString() : '';

  const pathname = `/organizations/${organization.slug}/stats_v2/`;

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

  const results = useApiQuery<PartialUsageStats>([pathname, endpointOptions], {
    staleTime: Infinity,
    enabled: !!traceNode,
  });

  return {
    ...results,
    data: results.data?.groups.find(group =>
      ['transaction_usage_exceeded', 'span_usage_exceeded'].includes(group.by.reason)
    ),
  };
}
