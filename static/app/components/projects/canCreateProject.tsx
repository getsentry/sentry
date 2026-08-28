import type {Organization, Team} from 'sentry/types/organization';

/**
 * Used to determine if viewer can see project creation button
 */
export function canCreateProject(organization: Organization, teams?: Team[]) {
  if (organization.access.includes('project:admin')) {
    return true;
  }

  // Org allows member project creation (no longer requires team-roles)
  if (organization.allowMemberProjectCreation) {
    return true;
  }

  // The API reports team-role scopes even on plans without the feature, where the
  // endpoint honors none of them, so this button would only lead to a 403.
  if (!organization.features.includes('team-roles')) {
    return false;
  }

  // Team admins can still create projects for their teams when member creation is disabled
  return Boolean(
    teams?.some(team => team.teamRole === 'admin' && team.access.includes('team:admin'))
  );
}
