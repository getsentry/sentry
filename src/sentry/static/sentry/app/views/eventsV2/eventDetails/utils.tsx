import {EventData} from '../data';
import EventView from '../eventView';

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

export function eventDetailsRouteWithEventView({
  orgSlug,
  eventSlug,
  eventView,
}: {
  orgSlug: string;
  eventSlug: string;
  eventView: EventView;
}) {
  const pathname = generateEventDetailsRoute({
    orgSlug,
    eventSlug,
  });

  return {
    pathname,
    query: eventView.generateQueryStringObject(),
  };
}
