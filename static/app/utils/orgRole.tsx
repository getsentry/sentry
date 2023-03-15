import {OrgRole} from 'sentry/types';

export function getTopOrgRole(memberOrgRoles: string[], orgRoleList: OrgRole[]) {
  // sort by ascending index
  const orgRoleMap = orgRoleList.reduce((acc, role, index) => {
    acc[role.id] = {index, role};
    return acc;
  }, {});
  memberOrgRoles.sort((a, b) => orgRoleMap[b].index - orgRoleMap[a].index);

  return orgRoleMap[memberOrgRoles[0]] ? orgRoleMap[memberOrgRoles[0]].role : undefined;
}
