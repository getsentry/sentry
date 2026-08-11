import {InfoText} from '@sentry/scraps/info';

import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useReorderStarredDashboards} from 'sentry/views/dashboards/hooks/useReorderStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

type DashboardsNavigationItemsProps = {
  dashboards: DashboardListItem[];
};

export function DashboardsNavigationItems({dashboards}: DashboardsNavigationItemsProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const reorderStarredDashboards = useReorderStarredDashboards();

  return (
    <SecondaryNavigation.ReorderableList
      items={dashboards}
      onDragEnd={newDashboards => {
        reorderStarredDashboards(newDashboards);
      }}
    >
      {dashboard => {
        const dashboardProjectIds = dashboard.projects ?? [];
        const dashboardProjects = new Set(dashboardProjectIds.map(String));
        const dashboardProjectPlatforms = projects
          .filter(p => dashboardProjects.has(p.id))
          .map(p => p.platform)
          .filter(defined);

        return (
          <SecondaryNavigation.ReorderableLink
            to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
            analyticsItemName="dashboard_starred_item"
            icon={
              <SecondaryNavigation.ProjectIcon
                projectPlatforms={dashboardProjectPlatforms}
                allProjects={
                  dashboardProjectIds.length === 1 && dashboardProjectIds[0] === -1
                }
              />
            }
          >
            <InfoText
              title={dashboard.title}
              position="top"
              mode="overflowOnly"
              variant="inherit"
            >
              {dashboard.title}
            </InfoText>
          </SecondaryNavigation.ReorderableLink>
        );
      }}
    </SecondaryNavigation.ReorderableList>
  );
}
