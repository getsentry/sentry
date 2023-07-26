import type {EventIdResponse} from 'sentry/types';

export function EventIdQueryResult(params = {}): EventIdResponse {
  const event = TestStubs.Event({
    metadata: {
      type: 'event type',
      value: 'event description',
    },
  });

  return {
    organizationSlug: 'org-slug',
    projectSlug: 'project-slug',
    groupId: event.groupID,
    eventId: event.eventID,
    event,
    ...params,
  };
}
