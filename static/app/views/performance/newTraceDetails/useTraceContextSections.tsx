import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function useTraceContextSections({
  tree,
  rootEventResults,
  logs,
}: {
  logs: OurLogsResponseItem[] | undefined;
  rootEventResults: TraceRootEventQueryResults;
  tree: TraceTree;
}) {
  const hasProfiles = tree.type === 'trace' && tree.profiled_events.size > 0;
  const hasLogs = logs && logs?.length > 0;
  const hasOnlyLogs = tree.type === 'empty' && hasLogs;

  const hasTags = hasOnlyLogs
    ? false // We don't show tags for only logs trace views
    : isTraceItemDetailsResponse(rootEventResults.data)
      ? rootEventResults.data.attributes.length > 0
      : rootEventResults.data && rootEventResults.data.tags.length > 0;

  const allowedVitals = Object.keys(VITAL_DETAILS);
  const hasVitals = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => allowedVitals.includes(`measurements.${vital.key}`))
  );

  return {
    hasProfiles,
    hasLogs,
    hasTags,
    hasVitals,
  };
}
