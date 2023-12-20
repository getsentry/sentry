import {EventTransaction} from 'sentry/types';
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
    [`/organizations/${organization.slug}/events/${projectSlug}:${eventId}/`],
    {staleTime: Infinity, enabled: Boolean(eventId && projectSlug && organization.slug)}
  );
}
