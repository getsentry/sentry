import type {EventTransaction} from 'sentry/types/event';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventId?: EventTransaction['id'];
  projectSlug?: string;
}

export function useEventDetails(props: Props) {
  const organization = useOrganization();
  const {eventId, projectSlug} = props;

  return useApiQuery<EventTransaction>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug!,
            eventId: eventId!,
          },
        }
      ),
    ],
    {staleTime: Infinity, enabled: Boolean(eventId && projectSlug && organization.slug)}
  );
}
