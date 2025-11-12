import {useMemo} from 'react';

import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import useOrganization from 'sentry/utils/useOrganization';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function useTraceContextSections({
  tree,
  logs,
  metrics,
}: {
  logs: OurLogsResponseItem[] | undefined;
  metrics: {count: number} | undefined;
  tree: TraceTree;
}) {
  const organization = useOrganization();

  const hasProfiles: boolean = tree.type === 'trace' && tree.profiled_events.size > 0;

  const hasLogs = !!(logs && logs?.length > 0);
  const hasMetrics = !!(metrics && metrics.count > 0);
  const hasOnlyLogs: boolean = tree.type === 'empty' && hasLogs;

  const allowedVitals = Object.keys(VITAL_DETAILS);
  const hasVitals: boolean = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => allowedVitals.includes(`measurements.${vital.key}`))
  );

  const hasSummary: boolean = organization.features.includes('single-trace-summary');
  const hasAiSpans = !!TraceTree.Find(tree.root, getIsAiNode);

  return useMemo(
    () => ({
      hasProfiles,
      hasTraceEvents: !hasOnlyLogs,
      hasLogs,
      hasVitals,
      hasSummary,
      hasAiSpans,
      hasMetrics,
    }),
    [hasProfiles, hasOnlyLogs, hasLogs, hasVitals, hasSummary, hasAiSpans, hasMetrics]
  );
}
