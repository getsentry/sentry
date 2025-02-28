import type {Organization, OrgRole} from 'sentry/types/organization';

export const ORG_ROLES: OrgRole[] = [
  {
    id: 'billing',
    name: 'Billing',
    isAllowed: true,
    desc: 'Can manage payment and compliance details.',
    minimumTeamRole: 'contributor',
    isTeamRolesAllowed: false,
  },
  {
    id: 'member',
    name: 'Member',
    isAllowed: true,
    desc: 'Members can view and act on events, as well as view most other data within the organization.',
    minimumTeamRole: 'contributor',
    isTeamRolesAllowed: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    isAllowed: true,
    desc: 'Gains admin access on all teams as well as the ability to add and remove members.',
    minimumTeamRole: 'admin',
    isTeamRolesAllowed: true,
  },
  {
    id: 'owner',
    name: 'Owner',
    isAllowed: true,
    desc: 'Unrestricted access to the organization, its data, and its settings. Can add, modify, and delete projects and members, as well as make billing and plan changes.',
    minimumTeamRole: 'admin',
    isTeamRolesAllowed: true,
  },
];

export function getOrgRoles(organization: Organization): OrgRole[] {
  if (organization.features.includes('team-roles')) {
    return ORG_ROLES;
  }
  const adminRole: OrgRole = {
    id: 'admin',
    name: 'Admin',
    isAllowed: true,
    desc: "Admin privileges on any teams of which they're a member. They can create new teams and projects, as well as remove teams and projects on which they already hold membership (or all teams, if open membership is enabled). Additionally, they can manage memberships of teams that they are members of. They cannot invite members to the organization.",
    minimumTeamRole: 'admin',
    isTeamRolesAllowed: true,
  };
  const rolesWithAdmin = [...ORG_ROLES];
  // insert admin role to keep roles ordered from least to most permissions
  rolesWithAdmin.splice(2, 0, adminRole);
  return rolesWithAdmin;
}
