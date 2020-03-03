import {EventData} from '../data';

export function generateEventDetailsRoute({
  eventSlug,
  orgSlug,
}: {
  eventSlug: string;
  orgSlug: String;
}): string {
  return `/organizations/${orgSlug}/discover/${eventSlug}/`;
}

export function generateEventSlug(eventData: EventData): string {
  const id = eventData.id || eventData.latest_event;
  const projectSlug = eventData.project || eventData['project.name'];

  return `${projectSlug}:${id}`;
}
