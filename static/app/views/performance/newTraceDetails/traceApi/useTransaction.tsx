import type {EventTransaction, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

interface UseTransactionProps {
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
}

export function useTransaction(props: UseTransactionProps) {
  return useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${props.node.value.project_slug}:${props.node.value.event_id}/`,
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
