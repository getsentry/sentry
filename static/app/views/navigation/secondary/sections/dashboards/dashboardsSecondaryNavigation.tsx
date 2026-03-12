import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {DEFAULT_PREBUILT_SORT} from 'sentry/views/dashboards/manage/settings';
import {DashboardFilter} from 'sentry/views/dashboards/types';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {isSidebarLinkActive} from 'sentry/views/navigation/primary/components';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';
import {DashboardsNavigationItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavigationItems';

export function DashboardsSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;
  const {projects} = useProjects();
  const user = useUser();

  const location = useLocation();
  const {data: starredDashboards = []} = useGetStarredDashboards();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const urlFilter = decodeScalar(location.query.filter) as DashboardFilter | undefined;
  const isOnlyPrebuilt = urlFilter === DashboardFilter.ONLY_PREBUILT;
  const isOnDashboardsList = isSidebarLinkActive(`${baseUrl}/`, location.pathname, {
    end: true,
  });

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Dashboards')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="dashboards-all">
          <SecondaryNavigation.Item
            to={`${baseUrl}/`}
            end
            isActive={
              hasPrebuiltDashboards ? isOnDashboardsList && !isOnlyPrebuilt : undefined
            }
            analyticsItemName="dashboards_all"
          >
            {t('All Dashboards')}
          </SecondaryNavigation.Item>
          {hasPrebuiltDashboards ? (
            <SecondaryNavigation.Item
              to={`${baseUrl}/?filter=${DashboardFilter.ONLY_PREBUILT}&sort=${DEFAULT_PREBUILT_SORT}`}
              isActive={isOnDashboardsList && isOnlyPrebuilt}
              analyticsItemName="dashboards_sentry_built"
            >
              {t('Sentry Built')}
            </SecondaryNavigation.Item>
          ) : null}
        </SecondaryNavigation.Section>
        {starredDashboards.length > 0 ? (
          <SecondaryNavigation.Section
            id="dashboards-starred"
            title={t('Starred Dashboards')}
          >
            <ErrorBoundary mini>
              {organization.features.includes('dashboards-starred-reordering') ? (
                <DashboardsNavigationItems initialDashboards={starredDashboards} />
              ) : (
                <StarredDashboardItems
                  dashboards={starredDashboards}
                  projects={projects}
                  organizationSlug={organization.slug}
                  organizationId={organization.id}
                  userId={user.id}
                />
              )}
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
