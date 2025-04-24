import type {EventTransaction} from 'sentry/types/event';
import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function useTraceContextSections({
  tree,
  rootEvent,
  logs,
}: {
  logs: OurLogsResponseItem[] | undefined;
  rootEvent: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
}) {
  const hasProfiles = tree.type === 'trace' && tree.profiled_events.size > 0;
  const hasLogs = logs && logs?.length > 0;
  const hasTags =
    rootEvent.data &&
    rootEvent.data.tags.length > 0 &&
    !(tree.type === 'empty' && hasLogs); // We don't show tags for only logs trace views

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
