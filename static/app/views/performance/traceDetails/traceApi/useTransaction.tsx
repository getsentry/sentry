import {useQuery} from '@tanstack/react-query';

import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface UseTransactionProps {
  event_id: string;
  organization: Organization;
  project_slug: string;
}

export function useTransaction(props: UseTransactionProps) {
  return useQuery({
    ...apiOptions.as<EventTransaction>()(
      '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
      {
        path: {
          organizationIdOrSlug: props.organization.slug,
          projectIdOrSlug: props.project_slug,
          eventId: props.event_id,
        },
        query: {
          referrer: 'trace-details-summary',
        },
        staleTime: 1000 * 60 * 10,
      }
    ),
    enabled: !!props.project_slug && !!props.event_id,
  });
}
