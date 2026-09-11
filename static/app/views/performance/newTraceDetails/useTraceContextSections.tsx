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
  logsCount,
  metrics,
  metricsCount,
  meta,
  logsEnabled = true,
  metricsEnabled = true,
}: {
  logs: OurLogsResponseItem[] | undefined;
  metrics: {count: number} | undefined;
  tree: TraceTree;
  logsCount?: number;
  logsEnabled?: boolean;
  meta?: TraceMetaQueryResults['data'];
  metricsCount?: number;
  metricsEnabled?: boolean;
}) {
  const hasProfiles = tree.type === 'trace' && tree.profiled_events.size > 0;

  const hasLogs =
    logsEnabled &&
    hasCount(
      getTraceMetaLogsCount(meta),
      logsCount === undefined ? !!(logs && logs.length > 0) : logsCount > 0
    );
  const hasMetrics =
    metricsEnabled &&
    hasCount(
      getTraceMetaMetricsCount(meta),
      metricsCount === undefined ? !!(metrics && metrics.count > 0) : metricsCount > 0
    );
  const hasOnlyNonTraceData = tree.type === 'empty' && (hasLogs || hasMetrics);

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
    meta === undefined
      ? !hasOnlyNonTraceData
      : traceEventCount > 0 || !hasOnlyNonTraceData;

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
