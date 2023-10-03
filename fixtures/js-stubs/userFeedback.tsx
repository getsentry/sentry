import {Event} from 'sentry-fixture/event';
import {Group} from 'sentry-fixture/group';
import {User} from 'sentry-fixture/user';

import type {UserReport as TUserReport} from 'sentry/types';

export function UserFeedback(params: Partial<TUserReport> = {}): TUserReport {
  const event = Event();
  return {
    id: '123',
    name: 'Lyn',
    email: 'lyn@sentry.io',
    comments: 'Something bad happened',
    dateCreated: '2018-12-20T00:00:00.000Z',
    issue: Group(),
    eventID: event.id,
    event,
    user: User(),
    ...params,
  };
}
