import {Member} from './member';

export function Members(params = []) {
  return [
    Member(),
    {
      id: '2',
      name: 'Sentry 2 Name',
      email: 'sentry2@test.com',
      orgRole: 'member',
      orgRolesFromTeams: [],
      teamRoles: [],
      role: 'member',
      roleName: 'Member',
      pending: true,
      flags: {
        'sso:linked': false,
        'idp:provisioned': false,
        'idp:role-restricted': false,
      },
      user: null,
    },
    {
      id: '3',
      name: 'Sentry 3 Name',
      email: 'sentry3@test.com',
      orgRole: 'owner',
      orgRolesFromTeams: [],
      teamRoles: [],
      role: 'owner',
      roleName: 'Owner',
      pending: false,
      flags: {
        'sso:linked': true,
        'idp:provisioned': false,
        'idp:role-restricted': false,
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
      orgRole: 'owner',
      orgRolesFromTeams: [],
      teamRoles: [],
      role: 'owner',
      roleName: 'Owner',
      pending: false,
      flags: {
        'sso:linked': true,
        'idp:provisioned': false,
        'idp:role-restricted': false,
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
