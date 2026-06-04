import {uuid4} from '@sentry/core';

import type {DetailedTeam} from 'sentry/types/organization';

export function TeamFixture(params: Partial<DetailedTeam> = {}): DetailedTeam {
  return {
    id: '1',
    slug: 'team-slug',
    name: 'Team Name',
    access: ['team:read'],
    teamRole: null,
    isMember: true,
    memberCount: 0,
    avatar: {avatarType: 'letter_avatar', avatarUuid: uuid4()},
    flags: {
      'idp:provisioned': false,
    },
    externalTeams: [],
    projects: [],
    hasAccess: false,
    isPending: false,
    ...params,
  };
}
