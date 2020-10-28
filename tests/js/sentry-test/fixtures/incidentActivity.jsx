import {User} from 'sentry-test/fixtures/user';

export function IncidentActivity(params) {
  return {
    comment: 'incident activity comment',
    type: 3,
    dateCreated: new Date(),
    user: User(),
    id: '123',
    incidentIdentifier: '999',
    ...params,
  };
}
