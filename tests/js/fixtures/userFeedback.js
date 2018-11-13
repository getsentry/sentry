import {Group} from './group';

export function UserFeedback(params = {}) {
  return {
    id: '123',
    name: 'Lyn',
    email: 'lyn@sentry.io',
    comments: 'Something bad happened',
    issue: Group(),
    ...params,
  };
}
