import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {EventTransaction} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface RawTransactionEvent {
  spans: RawSpanType[];
  type: 'transaction';
}

export function useEventJSON(
  eventID?: EventTransaction['eventID'],
  projectSlug?: string
) {
  const organization = useOrganization();

  return useApiQuery<RawTransactionEvent>(
    [`/projects/${organization.slug}/${projectSlug}/events/${eventID}/json/`],
    {staleTime: Infinity, enabled: Boolean(eventID && projectSlug && organization.slug)}
  );
}
