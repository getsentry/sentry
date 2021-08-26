import {Member} from './member';

export function Members(params = []) {
  return [
    Member(),
    {
      id: '2',
      name: 'Sentry 2 Name',
      email: 'sentry2@test.com',
      role: 'member',
      roleName: 'Member',
      pending: true,
      flags: {
        'sso:linked': false,
      },
      user: null,
    },
    {
      id: '3',
      name: 'Sentry 3 Name',
      email: 'sentry3@test.com',
      role: 'owner',
      roleName: 'Owner',
      pending: false,
      flags: {
        'sso:linked': true,
      },
      user: {
        id: '3',
        has2fa: true,
        name: 'Sentry 3 Name',
        email: 'sentry3@test.com',
        username: 'Sentry 3 Username',
      },
    },
    {
      id: '4',
      name: 'Sentry 4 Name',
      email: 'sentry4@test.com',
      role: 'owner',
      roleName: 'Owner',
      pending: false,
      flags: {
        'sso:linked': true,
      },
      user: {
        id: '4',
        has2fa: true,
        name: 'Sentry 4 Name',
        email: 'sentry4@test.com',
        username: 'Sentry 4 Username',
      },
    },
    ...params,
  ];
}
