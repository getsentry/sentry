import {useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';

import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';

function hasOrganizationRole(organization: Organization, roleRequired: string): boolean {
  if (!Array.isArray(organization.orgRoleList)) {
    return false;
  }

  const roleIds = organization.orgRoleList.map(r => r.id);

  const requiredIndex = roleIds.indexOf(roleRequired);
  const currentIndex = roleIds.indexOf(organization.orgRole ?? '');

  if (requiredIndex === -1 || currentIndex === -1) {
    return false;
  }

  // If the user is a lower role than the required role, they do not have access
  return currentIndex >= requiredIndex;
}

interface UseRoleOptions {
  /**
   * Minimum required role.
   * The required role ('member', 'admin') are stored in the organization object.
   * eg: Organization.debugFilesRole = 'member'
   */
  role: // Extract keys to enforce that they are available on the Organization type
  Extract<keyof Organization, 'debugFilesRole' | 'attachmentsRole'>;
}

interface UseRoleResult {
  hasRole: boolean;
  /**
   * The required role ('member', 'admin') from the organization object.
   */
  roleRequired: string;
}

export function useRole(options: UseRoleOptions): UseRoleResult {
  const organization = useOrganization();

  return useMemo((): UseRoleResult => {
    const roleRequired = organization[options.role];
    if (isActiveSuperuser()) {
      return {hasRole: true, roleRequired};
    }

    const hasRole = hasOrganizationRole(organization, roleRequired);
    return {hasRole, roleRequired};
  }, [organization, options.role]);
}
