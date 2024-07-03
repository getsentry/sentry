import type {Organization} from 'sentry/types/organization';

/**
 * Used to determine if viewer can see project creation button
 */
export function canCreateProject(organization: Organization) {
  if (organization.access.includes('project:admin')) {
    return true;
  }

  // Has member-project-creation feature and didn't disable in org-wide config
  if (
    organization.features.includes('team-roles') &&
    organization.allowMemberProjectCreation
  ) {
    return true;
  }

  return false;
}
