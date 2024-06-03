import type {BaseRole, OrgRole, TeamRole} from 'sentry/types/organization';

export function RoleFixture(params: Partial<BaseRole> = {}): BaseRole {
  return {
    id: 'member',
    name: 'Member',
    desc: '',
    ...params,
  };
}

export function TeamRoleFixture(params: Partial<TeamRole> = {}): TeamRole {
  return {
    ...RoleFixture(),
    isMinimumRoleFor: 'admin',
    ...params,
  };
}

export function OrgRoleFixture(params: Partial<OrgRole> = {}): OrgRole {
  return {
    ...RoleFixture(),
    minimumTeamRole: 'contributor',
    ...params,
  };
}
