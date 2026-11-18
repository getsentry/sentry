import type {Organization, Team} from 'sentry/types/organization';

/**
 * Team admins can still create projects for their teams when member creation is disabled
 */
export function isTeamAdminForProjectCreation(team: Team) {
  return team.teamRole === 'admin' && team.access.includes('team:admin');
}

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

  return Boolean(teams?.some(isTeamAdminForProjectCreation));
}
