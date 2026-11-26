import {useQuery} from '@tanstack/react-query';

import type {EventTransaction} from 'sentry/types/event';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  eventId?: EventTransaction['id'];
  projectSlug?: string;
}

export function useEventDetails(props: Props) {
  const organization = useOrganization();
  const {eventId, projectSlug} = props;

  return useQuery({
    ...apiOptions.as<EventTransaction>()(
      '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug!,
          eventId: eventId!,
        },
        staleTime: Infinity,
      }
    ),
    enabled: Boolean(eventId && projectSlug && organization.slug),
  });
}
