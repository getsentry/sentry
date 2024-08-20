import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

interface UseTransactionProps {
  node: null | {
    value: {
      event_id: TraceTree.Transaction['event_id'];
      project_slug: TraceTree.Transaction['project_slug'];
    };
  };
  organization: Organization;
}

export function useTransaction(props: UseTransactionProps) {
  return useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${props.node?.value?.project_slug}:${props.node?.value.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!props.node,
    }
  );
}
