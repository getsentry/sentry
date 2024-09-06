import {UserFixture} from 'sentry-fixture/user';

import type {Member} from 'sentry/types/organization';

export function MemberFixture(params: Partial<Member> = {}): Member {
  return {
    id: '1',
    email: 'sentry1@test.com',
    name: 'Sentry 1 Name',
    orgRole: 'member',
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
      'partnership:restricted': false,
    },
    user: UserFixture(),
    inviteStatus: 'approved',
    ...params,
  };
}
