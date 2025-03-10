import type {EventTransaction} from 'sentry/types/event';
import {isTraceSplitResult} from 'sentry/utils/performance/quickTrace/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function useTraceRootEvent(trace: TraceTree.Trace | null) {
  const root = trace
    ? isTraceSplitResult(trace)
      ? trace?.transactions?.[0] || trace?.orphan_errors?.[0]
      : trace[0]
    : null;
  const organization = useOrganization();

  return useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${root?.project_slug}:${root?.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!trace && !!root?.project_slug && !!root?.event_id,
    }
  );
}
