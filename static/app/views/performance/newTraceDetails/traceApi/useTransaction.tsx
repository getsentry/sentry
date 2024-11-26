import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';

interface UseTransactionProps {
  node: TraceTreeNode<TraceTree.Transaction> | null;
  organization: Organization;
}

export function useTransaction(props: UseTransactionProps) {
  return useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${props.node?.value?.project_slug}:${props?.node?.value.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!props.node?.value?.project_slug && !!props.node?.value.event_id,
    }
  );
}
