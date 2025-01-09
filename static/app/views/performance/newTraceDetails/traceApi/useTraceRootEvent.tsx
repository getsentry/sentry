import type {EventTransaction} from 'sentry/types/event';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useTraceRootEvent(trace: TraceSplitResults<TraceFullDetailed> | null) {
  const root = trace?.transactions?.[0] || trace?.orphan_errors?.[0];
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
