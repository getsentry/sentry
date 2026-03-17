import * as Sentry from '@sentry/react';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useReorderStarredDashboards} from 'sentry/views/dashboards/hooks/useReorderStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

type DashboardsNavigationItemsProps = {
  initialDashboards: DashboardListItem[];
};

export function DashboardsNavigationItems({
  initialDashboards,
}: DashboardsNavigationItemsProps) {
  const organization = useOrganization();
  const user = useUser();
  const location = useLocation();
  const id = getIdFromLocation(location);

  const {projects} = useProjects();

  const reorderStarredDashboards = useReorderStarredDashboards();

  return (
    <SecondaryNavigation.ReorderableList
      items={initialDashboards}
      onDragEnd={newDashboards => {
        reorderStarredDashboards(newDashboards);
      }}
    >
      {dashboard => {
        const dashboardProjects = new Set((dashboard?.projects ?? []).map(String));
        if (!defined(dashboard?.projects)) {
          SentryLogDashboardProjectsUndefined(dashboard, {
            organizationId: organization.id,
            userId: user.id,
          });
        }

        const dashboardProjectPlatforms = projects
          .filter(p => dashboardProjects.has(p.id))
          .map(p => p.platform)
          .filter(defined);

        return (
          <SecondaryNavigation.ReorderableLink
            to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
            analyticsItemName="dashboard_starred_item"
            isActive={id === dashboard.id.toString()}
            icon={
              <SecondaryNavigation.ProjectIcon
                projectPlatforms={dashboardProjectPlatforms}
                allProjects={
                  dashboard.projects?.length === 1 && dashboard.projects[0] === -1
                }
              />
            }
          >
            <Tooltip
              title={dashboard.title}
              position="top"
              showOnlyOnOverflow
              skipWrapper
            >
              <Text ellipsis variant="muted">
                {dashboard.title}
              </Text>
            </Tooltip>
          </SecondaryNavigation.ReorderableLink>
        );
      }}
    </SecondaryNavigation.ReorderableList>
  );
}

function SentryLogDashboardProjectsUndefined(
  dashboard: DashboardListItem,
  {organizationId, userId}: {organizationId: string; userId: string}
) {
  Sentry.setTag('organization', organizationId);
  Sentry.setTag('dashboard.id', dashboard.id);
  Sentry.setTag('user.id', userId);
  Sentry.captureMessage('dashboard.projects is undefined in starred sidebar', {
    level: 'warning',
  });
}
