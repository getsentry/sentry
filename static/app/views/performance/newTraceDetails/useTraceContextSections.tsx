import {useMemo} from 'react';

import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import useOrganization from 'sentry/utils/useOrganization';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {hasAgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {getIsAiNode} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function useTraceContextSections({
  tree,
  rootEventResults,
  logs,
}: {
  logs: OurLogsResponseItem[] | undefined;
  rootEventResults: TraceRootEventQueryResults;
  tree: TraceTree;
}) {
  const organization = useOrganization();

  const hasProfiles: boolean = tree.type === 'trace' && tree.profiled_events.size > 0;

  const hasLogs = !!(logs && logs?.length > 0);
  const hasOnlyLogs: boolean = tree.type === 'empty' && hasLogs;

  const hasTags: boolean = hasOnlyLogs
    ? false // We don't show tags for only logs trace views
    : isTraceItemDetailsResponse(rootEventResults.data)
      ? rootEventResults.data.attributes.length > 0
      : Boolean(rootEventResults.data?.tags.length);

  const allowedVitals = Object.keys(VITAL_DETAILS);
  const hasVitals: boolean = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => allowedVitals.includes(`measurements.${vital.key}`))
  );

  const hasSummary: boolean = organization.features.includes('single-trace-summary');
  const hasAiSpans: boolean =
    hasAgentInsightsFeature(organization) && !!TraceTree.Find(tree.root, getIsAiNode);

  return useMemo(
    () => ({
      hasProfiles,
      hasTraceEvents: !hasOnlyLogs,
      hasLogs,
      hasTags,
      hasVitals,
      hasSummary,
      hasAiSpans,
    }),
    [hasProfiles, hasOnlyLogs, hasLogs, hasTags, hasVitals, hasSummary, hasAiSpans]
  );
}
