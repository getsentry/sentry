import type {Member as MemberType} from 'sentry/types';

import {User} from './user';

export function Member(params: Partial<MemberType> = {}): MemberType {
  // test
  return {
    id: '1',
    email: 'sentry1@test.com',
    name: 'Sentry 1 Name',
    orgRole: 'member',
    groupOrgRoles: [],
    teamRoles: [],
    role: 'member',
    roleName: 'Member',
    pending: false,
    expired: false,
    dateCreated: '2020-01-01T00:00:00.000Z',
    invite_link: null,
    inviterName: null,
    isOnlyOwner: false,
    orgRoleList: [],
    projects: [],
    roles: [],
    teamRoleList: [],
    teams: [],
    flags: {
      'sso:linked': false,
      'idp:provisioned': false,
      'idp:role-restricted': false,
      'member-limit:restricted': false,
      'sso:invalid': false,
    },
    user: User(),
    inviteStatus: 'approved',
    ...params,
  };
}
