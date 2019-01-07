import {Group} from './group';
import {Event} from './event';

export function UserFeedback(params = {}) {
  return {
    id: '123',
    name: 'Lyn',
    email: 'lyn@sentry.io',
    comments: 'Something bad happened',
    dateCreated: '2018-12-20T00:00:00.000Z',
    issue: Group(),
    event: Event(),
    ...params,
  };
}
