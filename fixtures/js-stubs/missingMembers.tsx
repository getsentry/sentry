import {MissingMember} from 'sentry/types';

export function MissingMembers(params = []): MissingMember[] {
  return [
    {
      commitCount: 6,
      email: 'hello@sentry.io',
      externalId: 'hello',
    },
    {
      commitCount: 5,
      email: 'abcd@sentry.io',
      externalId: 'abcd',
    },
    {
      commitCount: 4,
      email: 'hola@sentry.io',
      externalId: 'hola',
    },
    {
      commitCount: 3,
      email: 'test@sentry.io',
      externalId: 'test',
    },
    {
      commitCount: 2,
      email: 'five@sentry.io',
      externalId: 'five',
    },
    ...params,
  ];
}
