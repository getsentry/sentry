import {OrgRole, TeamRole} from 'sentry/types';

export function OrgRoleList(
  params: OrgRole[] = [],
  fullAccess: boolean = false
): OrgRole[] {
  return [
    {
      id: 'member',
      name: 'Member',
      desc: 'Members can view and act on events, as well as view most other data within the organization.',
      allowed: true,
      isAllowed: true,
      is_global: false,
      isGlobal: false,
      isRetired: false,
      minimumTeamRole: 'contributor',
    },
    {
      id: 'admin',
      name: 'Admin',
      desc: "Admin privileges on any teams of which they're a member. They can create new teams and projects, as well as remove teams and projects on which they already hold membership (or all teams, if open membership is enabled). Additionally, they can manage memberships of teams that they are members of. They cannot invite members to the organization.",
      allowed: fullAccess,
      isAllowed: fullAccess,
      is_global: false,
      isGlobal: false,
      isRetired: false,
      minimumTeamRole: 'admin',
    },
    {
      id: 'manager',
      name: 'Manager',
      desc: 'Gains admin access on all teams as well as the ability to add and remove members.',
      allowed: fullAccess,
      isAllowed: fullAccess,
      is_global: true,
      isGlobal: true,
      isRetired: false,
      minimumTeamRole: 'admin',
    },
    {
      id: 'owner',
      name: 'Owner',
      desc: 'Gains full permission across the organization. Can manage members as well as perform catastrophic operations such as removing the organization.',
      allowed: fullAccess,
      isAllowed: fullAccess,
      is_global: true,
      isGlobal: true,
      isRetired: false,
      minimumTeamRole: 'admin',
    },
    ...params,
  ];
}

export function TeamRoleList(params: TeamRole[] = []): TeamRole[] {
  return [
    {
      id: 'contributor',
      name: 'Contributor',
      desc: '...',
      isRetired: false,
      isMinimumRoleFor: '',
    },
    {
      id: 'admin',
      name: 'Team Admin',
      desc: '...',
      isRetired: false,
      isMinimumRoleFor: '',
    },
    ...params,
  ];
}
