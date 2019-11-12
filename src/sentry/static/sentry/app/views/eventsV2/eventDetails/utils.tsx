import {Organization} from 'app/types';

export function generateEventDetailsRoute({
  eventSlug,
  organization,
}: {
  eventSlug: string;
  organization: Organization;
}): string {
  return `/organizations/${organization.slug}/eventsv2/${eventSlug}/`;
}
