import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Organization, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {DashboardPermissions} from 'sentry/views/dashboards/types';

/**
 *  Checks if current user has permissions to edit dashboard
 */
export function checkUserHasEditAccess(
  currentUser: User,
  userTeams: Team[],
  organization: Organization,
  dashboardPermissions?: DashboardPermissions,
  dashboardCreator?: User
): boolean {
  if (
    hasEveryAccess(['org:admin'], {organization}) || // Owners
    !dashboardPermissions ||
    dashboardPermissions.isEditableByEveryone ||
    dashboardCreator?.id === currentUser.id
  ) {
    return true;
  }
  if (dashboardPermissions.teamsWithEditAccess?.length) {
    const userTeamIds = userTeams.map(team => Number(team.id));
    return dashboardPermissions.teamsWithEditAccess.some(teamId =>
      userTeamIds.includes(teamId)
    );
  }
  return false;
}
