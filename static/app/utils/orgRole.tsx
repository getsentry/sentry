import {OrgRole} from 'sentry/types';

export function getEffectiveOrgRole(memberOrgRoles: string[], orgRoleList: OrgRole[]) {
  const orgRoleMap = orgRoleList.reduce((acc, role, index) => {
    acc[role.id] = {index, role};
    return acc;
  }, {});

  // sort by ascending index (high to low priority)
  memberOrgRoles.sort((a, b) => orgRoleMap[b].index - orgRoleMap[a].index);

  if (!orgRoleMap[memberOrgRoles[0]]) {
    throw new Error('Unable to find org role in list');
  }
  return orgRoleMap[memberOrgRoles[0]].role;
}
