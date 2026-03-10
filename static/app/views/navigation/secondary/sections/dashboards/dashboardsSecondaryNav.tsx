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
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import ProjectIcon from 'sentry/views/navigation/projectIcon';
import {SecondaryNav} from 'sentry/views/navigation/secondary/secondary';
import {DashboardsNavItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavItems';
import {PrimaryNavGroup} from 'sentry/views/navigation/types';

export function DashboardsSecondaryNav() {
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
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.DASHBOARDS].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section id="dashboards-all">
          <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="dashboards_all">
            {t('All Dashboards')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        {customDashboards.length > 0 ? (
          <SecondaryNav.Section id="dashboards-starred" title={t('Starred Dashboards')}>
            <ErrorBoundary mini>
              {organization.features.includes('dashboards-starred-reordering') ? (
                <DashboardsNavItems initialDashboards={customDashboards} />
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
          </SecondaryNav.Section>
        ) : null}
        {prebuiltDashboards.length > 0 ? (
          <SecondaryNav.Section
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
          </SecondaryNav.Section>
        ) : null}
      </SecondaryNav.Body>
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
      <SecondaryNav.Item
        key={dashboard.id}
        to={`/organizations/${organizationSlug}/dashboard/${dashboard.id}/`}
        analyticsItemName="dashboard_starred_item"
        leadingItems={
          <ProjectIcon
            projectPlatforms={dashboardProjectPlatforms}
            allProjects={dashboard.projects?.length === 1 && dashboard.projects[0] === -1}
          />
        }
      >
        {dashboard.title}
      </SecondaryNav.Item>
    );
  });
}
