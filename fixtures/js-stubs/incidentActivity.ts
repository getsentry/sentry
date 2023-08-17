import {ActivityTypeDraft} from 'sentry/views/alerts/types';

import {User} from './user';

export function IncidentActivity(
  params: Partial<ActivityTypeDraft> = {}
): ActivityTypeDraft {
  return {
    comment: 'incident activity comment',
    type: 3,
    dateCreated: '',
    user: User(),
    id: '123',
    incidentIdentifier: '999',
    ...params,
  };
}
