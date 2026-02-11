import {useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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

// Helper function to safely get role from project
function getProjectRole(
  project: Project | undefined,
  role: 'debugFilesRole' | 'attachmentsRole'
): string | undefined {
  if (!project) return undefined;

  if (role === 'debugFilesRole') {
    return project.debugFilesRole ?? undefined;
  }
  if (role === 'attachmentsRole') {
    return project.attachmentsRole ?? undefined;
  }

  return undefined;
}

interface UseRoleOptions {
  /**
   * Minimum required role.
   * The required role ('member', 'admin') are stored in the organization object.
   * eg: Organization.debugFilesRole = 'member'
   */
  role: Extract<keyof Organization, 'debugFilesRole' | 'attachmentsRole'>; // Extract keys to enforce that they are available on the Organization type
  /**
   * Project.
   * If not provided, the role will be checked against the organization.
   */
  project?: Project | undefined;
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
    let roleRequired = organization[options.role];

    // If the project has a role defined, it overrides the organization role
    const projectRole = getProjectRole(options.project, options.role);
    if (projectRole !== undefined && projectRole !== null) {
      roleRequired = projectRole;
    }

    if (isActiveSuperuser()) {
      return {hasRole: true, roleRequired};
    }

    const hasRole = hasOrganizationRole(organization, roleRequired);
    return {hasRole, roleRequired};
  }, [organization, options.role, options.project]);
}
