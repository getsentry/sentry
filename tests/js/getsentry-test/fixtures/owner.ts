import {UserFixture} from 'sentry-fixture/user';

import type {Member} from 'sentry/types/organization';

export function OwnerFixture(params: Partial<Member> = {}): Member {
  const mockUser = UserFixture();
  return {
    dateCreated: mockUser.dateJoined,
    email: mockUser.email,
    flags: {
      'idp:provisioned': false,
      'idp:role-restricted': false,
      'member-limit:restricted': false,
      'sso:invalid': false,
      'sso:linked': false,
      'partnership:restricted': false,
    },
    id: mockUser.id,
    name: mockUser.name,
    pending: false,
    role: 'owner',
    roleName: 'Organization Owner',
    user: mockUser,
    expired: false,
    inviteStatus: 'approved',
    invite_link: '',
    inviterName: null,
    isOnlyOwner: true,
    orgRole: 'owner',
    orgRoleList: [],
    projects: [],
    roles: [],
    teamRoleList: [],
    teams: [],
    teamRoles: [],
    ...params,
  };
}
