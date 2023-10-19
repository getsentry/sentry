import {uuid4} from '@sentry/utils';

import type {Team as TeamType} from 'sentry/types';

export function Team(params: Partial<TeamType> = {}): TeamType {
  return {
    id: '1',
    slug: 'team-slug',
    name: 'Team Name',
    access: ['team:read'],
    orgRole: undefined, // TODO(cathy): Rename this
    teamRole: null,
    isMember: true,
    memberCount: 0,
    avatar: {avatarType: 'letter_avatar', avatarUuid: uuid4()},
    flags: {
      'idp:provisioned': false,
    },
    externalTeams: [],
    hasAccess: false,
    isPending: false,
    ...params,
  };
}
