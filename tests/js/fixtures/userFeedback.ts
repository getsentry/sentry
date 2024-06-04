import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {UserFixture} from 'sentry-fixture/user';

import type {UserReport} from 'sentry/types/group';

export function UserFeedbackFixture(params: Partial<UserReport> = {}): UserReport {
  const event = EventFixture();
  return {
    id: '123',
    name: 'Lyn',
    email: 'lyn@sentry.io',
    comments: 'Something bad happened',
    dateCreated: '2018-12-20T00:00:00.000Z',
    issue: GroupFixture(),
    eventID: event.id,
    event,
    user: UserFixture(),
    ...params,
  };
}
