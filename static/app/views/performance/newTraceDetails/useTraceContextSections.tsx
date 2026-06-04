import {useMemo} from 'react';

import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getTraceMetaAiSpanCount,
  getTraceMetaErrorCount,
  getTraceMetaLogsCount,
  getTraceMetaMetricsCount,
  getTraceMetaPerformanceIssueCount,
  getTraceMetaSpanCount,
  getTraceMetaTransactionCount,
  getTraceMetaUptimeCount,
  type TraceMetaQueryResults,
} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

function hasCount(count: number | undefined, fallback: boolean): boolean {
  return count === undefined ? fallback : count > 0;
}

export function useTraceContextSections({
  tree,
  logs,
  metrics,
  meta,
  logsEnabled = true,
  metricsEnabled = true,
}: {
  logs: OurLogsResponseItem[] | undefined;
  metrics: {count: number} | undefined;
  tree: TraceTree;
  logsEnabled?: boolean;
  meta?: TraceMetaQueryResults['data'];
  metricsEnabled?: boolean;
}) {
  const hasProfiles = tree.type === 'trace' && tree.profiled_events.size > 0;

  const hasLogs =
    logsEnabled && hasCount(getTraceMetaLogsCount(meta), !!(logs && logs?.length > 0));
  const hasMetrics =
    metricsEnabled &&
    hasCount(getTraceMetaMetricsCount(meta), !!(metrics && metrics.count > 0));
  const hasOnlyLogs = tree.type === 'empty' && hasLogs;

  const allowedVitals = Object.keys(VITAL_DETAILS);
  const hasVitals: boolean = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => allowedVitals.includes(`measurements.${vital.key}`))
  );

  const hasAiSpans =
    (getTraceMetaAiSpanCount(meta) ?? 0) > 0 || !!tree.root.findChild(getIsAiNode);

  const traceEventCount =
    (getTraceMetaSpanCount(meta) ?? 0) +
    (getTraceMetaErrorCount(meta) ?? 0) +
    (getTraceMetaPerformanceIssueCount(meta) ?? 0) +
    (getTraceMetaTransactionCount(meta) ?? 0) +
    (getTraceMetaUptimeCount(meta) ?? 0);

  const hasTraceEvents =
    meta === undefined ? !hasOnlyLogs : traceEventCount > 0 || !hasOnlyLogs;

  return useMemo(
    () => ({
      hasProfiles,
      hasTraceEvents,
      hasLogs,
      hasVitals,
      hasAiSpans,
      hasMetrics,
    }),
    [hasProfiles, hasTraceEvents, hasLogs, hasVitals, hasAiSpans, hasMetrics]
  );
}
