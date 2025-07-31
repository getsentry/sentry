import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

interface UseTransactionProps {
  event_id: string;
  organization: Organization;
  project_slug: string;
}

export function useTransaction(props: UseTransactionProps) {
  return useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${props.project_slug}:${props.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      // 10 minutes
      staleTime: 1000 * 60 * 10,
      enabled: !!props.project_slug && !!props.event_id,
    }
  );
}
