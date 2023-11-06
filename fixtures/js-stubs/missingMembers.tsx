import {MissingMember} from 'sentry/types';

export function MissingMembers(params = []): MissingMember[] {
  return [
    {
      commitCount: 6,
      email: 'hello@sentry.io',
      externalId: 'github:hello',
    },
    {
      commitCount: 5,
      email: 'abcd@sentry.io',
      externalId: 'github:abcd',
    },
    {
      commitCount: 4,
      email: 'hola@sentry.io',
      externalId: 'github:hola',
    },
    {
      commitCount: 3,
      email: 'test@sentry.io',
      externalId: 'github:test',
    },
    {
      commitCount: 2,
      email: 'five@sentry.io',
      externalId: 'github:five',
    },
    {
      commitCount: 1,
      email: 'six@sentry.io',
      externalId: 'github:six',
    },
    {
      commitCount: 1,
      email: 'last@sentry.io',
      externalId: 'github:last',
    },
    ...params,
  ];
}
