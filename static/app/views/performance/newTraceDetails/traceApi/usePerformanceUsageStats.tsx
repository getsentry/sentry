import {useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {TraceTree} from '../traceModels/traceTree';

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

// Returns the performance usage stats for the window of trace start -1h to trace end +1h
export function usePerformanceUsageStats({
  organization,
  tree,
}: {
  organization: Organization;
  tree: TraceTree;
}) {
  // The root node carries the combined start/end time of all of its events.
  const traceNode = tree.root;

  // Warning: this relies on the trace unit being in milliseconds, which might be configurable in the future
  const [periodStart, periodEnd] = useMemo(() => {
    const traceStartDate = new Date(traceNode?.space?.[0]);
    const traceEndDate = new Date(traceNode?.space?.[0] + traceNode?.space?.[1]);

    // Add 1 hour buffer to the trace start and end date for the usage stats query.
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const start = traceNode
      ? new Date(traceStartDate.getTime() - ONE_HOUR_MS).toISOString()
      : '';
    const end = traceNode
      ? new Date(traceEndDate.getTime() + ONE_HOUR_MS).toISOString()
      : '';

    return [start, end];
  }, [traceNode]);

  const endpointOptions = {
    query: {
      start: periodStart,
      end: periodEnd,
      interval: '1h',
      groupBy: ['outcome', 'reason'],
      field: 'sum(quantity)',
      utc: true,
      category: 'transaction_indexed',
      project: Array.from(tree.project_ids),
      referrer: 'trace-view-warnings',
    },
  };

  const results = useApiQuery<PartialUsageStats>(
    [`/organizations/${organization.slug}/stats_v2/`, endpointOptions],
    {
      staleTime: Infinity,
      enabled: !!traceNode,
    }
  );

  return {
    ...results,
    data: results.data?.groups.find(group =>
      ['transaction_usage_exceeded', 'span_usage_exceeded'].includes(group.by.reason)
    ),
  };
}
