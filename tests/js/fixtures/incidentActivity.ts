import {UserFixture} from 'sentry-fixture/user';

import {ActivityTypeDraft} from 'sentry/views/alerts/types';

export function IncidentActivityFixture(
  params: Partial<ActivityTypeDraft> = {}
): ActivityTypeDraft {
  return {
    comment: 'incident activity comment',
    type: 3,
    dateCreated: '',
    user: UserFixture(),
    id: '123',
    incidentIdentifier: '999',
    ...params,
  };
}
