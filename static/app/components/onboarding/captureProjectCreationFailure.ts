import * as Sentry from '@sentry/react';

import type {Organization, Team} from 'sentry/types/organization';
import type {ProjectCreationVariant} from 'sentry/utils/analytics/projectCreationAnalyticsEvents';

interface CaptureProjectCreationFailureParams {
  accessTeams: Team[];
  error: any;
  organization: Organization;
  variant: ProjectCreationVariant;
  team?: string;
}

/**
 * Report a failed project creation to Sentry, identically for both flows.
 *
 * The message strings are shared on purpose: grouping is by message, so both
 * flows land in one group per failure mode and the `project_creation_variant`
 * tag splits them back apart. 409 is skipped because a duplicate project name
 * is user error, not a defect.
 */
export function captureProjectCreationFailure({
  error,
  organization,
  team,
  accessTeams,
  variant,
}: CaptureProjectCreationFailureParams): void {
  if (error?.status === 403) {
    Sentry.withScope(scope => {
      scope.setTag('project_creation_variant', variant);
      scope.setExtra('err', error);
      scope.setContext('permission_context', {
        org_slug: organization.slug,
        team,
        org_access: organization.access,
        org_features: organization.features,
        org_allow_member_project_creation: organization.allowMemberProjectCreation,
        user_team_access: team
          ? accessTeams.find(teamItem => teamItem.slug === team)?.access
          : null,
        available_teams_count: accessTeams.length,
      });
      Sentry.captureMessage('Project creation permission denied');
    });
    return;
  }

  if (error?.status === 409) {
    return;
  }

  Sentry.withScope(scope => {
    scope.setTag('project_creation_variant', variant);
    scope.setExtra('err', error);
    Sentry.captureMessage('Project creation failed');
  });
}
