import {Fragment, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';
import {DashboardsNavigationItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavigationItems';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

export function DashboardsSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;
  const {projects} = useProjects();
  const user = useUser();

  const {data: starredDashboards = []} = useGetStarredDashboards();

  const {prebuiltDashboards, customDashboards} = useMemo(
    () => ({
      prebuiltDashboards: starredDashboards.filter(d => defined(d.prebuiltId)),
      customDashboards: starredDashboards.filter(d => !defined(d.prebuiltId)),
    }),
    [starredDashboards]
  );

  return (
    <Fragment>
      <SecondaryNavigation.Header>
        {PRIMARY_NAVIGATION_GROUP_CONFIG[PrimaryNavigationGroup.DASHBOARDS].label}
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="dashboards-all">
          <SecondaryNavigation.Item
            to={`${baseUrl}/`}
            end
            analyticsItemName="dashboards_all"
          >
            {t('All Dashboards')}
          </SecondaryNavigation.Item>
        </SecondaryNavigation.Section>
        {customDashboards.length > 0 ? (
          <SecondaryNavigation.Section
            id="dashboards-starred"
            title={t('Starred Dashboards')}
          >
            <ErrorBoundary mini>
              {organization.features.includes('dashboards-starred-reordering') ? (
                <DashboardsNavigationItems initialDashboards={customDashboards} />
              ) : (
                <StarredDashboardItems
                  dashboards={customDashboards}
                  projects={projects}
                  organizationSlug={organization.slug}
                  organizationId={organization.id}
                  userId={user.id}
                />
              )}
            </ErrorBoundary>
          </SecondaryNavigation.Section>
        ) : null}
        {prebuiltDashboards.length > 0 ? (
          <SecondaryNavigation.Section
            id="dashboards-starred-sentry"
            title={t('Starred Sentry Built')}
          >
            <ErrorBoundary mini>
              <StarredDashboardItems
                dashboards={prebuiltDashboards}
                projects={projects}
                organizationSlug={organization.slug}
                organizationId={organization.id}
                userId={user.id}
              />
            </ErrorBoundary>
          </SecondaryNavigation.Section>
        ) : null}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

function StarredDashboardItems({
  dashboards,
  projects,
  organizationSlug,
  organizationId,
  userId,
}: {
  dashboards: DashboardListItem[];
  organizationId: string;
  organizationSlug: string;
  projects: Project[];
  userId: string;
}) {
  return dashboards.map(dashboard => {
    const dashboardProjects = new Set((dashboard?.projects ?? []).map(String));
    if (!defined(dashboard?.projects)) {
      Sentry.setTag('organization', organizationId);
      Sentry.setTag('dashboard.id', dashboard.id);
      Sentry.setTag('user.id', userId);
      Sentry.captureMessage('dashboard.projects is undefined in starred sidebar', {
        level: 'warning',
      });
    }
    const dashboardProjectPlatforms = projects
      .filter(p => dashboardProjects.has(p.id))
      .map(p => p.platform)
      .filter(defined);
    return (
      <SecondaryNavigation.Item
        key={dashboard.id}
        to={`/organizations/${organizationSlug}/dashboard/${dashboard.id}/`}
        analyticsItemName="dashboard_starred_item"
        leadingItems={
          <SecondaryNavigation.ProjectIcon
            projectPlatforms={dashboardProjectPlatforms}
            allProjects={dashboard.projects?.length === 1 && dashboard.projects[0] === -1}
          />
        }
      >
        {dashboard.title}
      </SecondaryNavigation.Item>
    );
  });
}
