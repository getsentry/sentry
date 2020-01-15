import {EventData} from '../data';

export function generateEventDetailsRoute({
  eventSlug,
  orgSlug,
}: {
  eventSlug: string;
  orgSlug: String;
}): string {
  return `/organizations/${orgSlug}/eventsv2/${eventSlug}/`;
}

export function generateEventSlug(eventData: EventData): string {
  const id = eventData.id || eventData.latest_event;

  return `${eventData['project.name']}:${id}`;
}
