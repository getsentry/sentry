import {useMemo} from 'react';

import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
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
      meta?.logsCount,
      logsCount === undefined ? !!(logs && logs.length > 0) : logsCount > 0
    );
  const hasMetrics =
    metricsEnabled &&
    hasCount(
      meta?.metricsCount,
      metricsCount === undefined ? !!(metrics && metrics.count > 0) : metricsCount > 0
    );
  const hasOnlyNonTraceData = tree.type === 'empty' && (hasLogs || hasMetrics);

  const allowedVitals = Object.keys(VITAL_DETAILS);
  const hasVitals: boolean = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => allowedVitals.includes(`measurements.${vital.key}`))
  );

  const aiSpanCount = Object.entries(meta?.spansCountMap ?? {}).reduce(
    (count, [op, opCount]) => (op.startsWith('gen_ai') ? count + opCount : count),
    0
  );
  const hasAiSpans = aiSpanCount > 0 || !!tree.root.findChild(getIsAiNode);

  const traceEventCount =
    (meta?.spansCount ?? 0) +
    (meta?.errorsCount ?? 0) +
    (meta?.performanceIssuesCount ?? 0) +
    (meta?.uptimeCount ?? 0);

  const hasTraceEvents =
    meta === undefined
      ? !hasOnlyNonTraceData
      : traceEventCount > 0 || !hasOnlyNonTraceData;

  return useMemo(
    () => ({hasProfiles, hasTraceEvents, hasLogs, hasVitals, hasAiSpans, hasMetrics}),
    [hasProfiles, hasTraceEvents, hasLogs, hasVitals, hasAiSpans, hasMetrics]
  );
}
