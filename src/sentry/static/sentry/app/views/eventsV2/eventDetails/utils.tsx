import {Organization} from 'app/types';

import {EventData} from '../data';

export function generateEventDetailsRoute({
  eventSlug,
  organization,
}: {
  eventSlug: string;
  organization: Organization;
}): string {
  return `/organizations/${organization.slug}/eventsv2/${eventSlug}/`;
}

export function generateEventSlug(eventData: EventData): string {
  const id = eventData.id || eventData.latest_event;

  return `${eventData['project.name']}:${id}`;
}
