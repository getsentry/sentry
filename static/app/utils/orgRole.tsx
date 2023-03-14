import {OrgRole} from 'sentry/types';

export function getTopOrgRole(memberOrgRoles: string[], orgRoleList: OrgRole[]) {
  // sort by ascending index
  memberOrgRoles.sort((a, b) =>
    orgRoleList.findIndex(r => r.id === a) < orgRoleList.findIndex(r => r.id === b)
      ? 1
      : -1
  );

  return orgRoleList.find(r => r.id === memberOrgRoles[0]);
}
