import {EventFixture} from 'sentry-fixture/event';

import type {EventIdResponse} from 'sentry/types/event';

export function EventIdQueryResultFixture(params = {}): EventIdResponse {
  const event = EventFixture({
    metadata: {
      type: 'event type',
      value: 'event description',
    },
  });

  return {
    organizationSlug: 'org-slug',
    projectSlug: 'project-slug',
    groupId: event.groupID || '',
    eventId: event.eventID,
    event,
    ...params,
  };
}
