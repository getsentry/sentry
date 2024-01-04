import type {Organization} from 'sentry/types/organization';

/**
 * Used to determine if viewer can see project creation button
 */
export function useProjectCreationAccess({organization}: {organization: Organization}) {
  if (organization.access.includes('project:admin')) {
    return {canCreateProject: true};
  }

  // Has member-project-creation feature and didn't disable in org-wide config
  if (
    organization.features.includes('team-roles') &&
    organization.allowMemberProjectCreation
  ) {
    return {canCreateProject: true};
  }

  return {canCreateProject: false};
}
