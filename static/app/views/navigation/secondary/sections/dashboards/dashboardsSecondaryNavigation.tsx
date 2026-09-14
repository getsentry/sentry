import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {DEFAULT_PREBUILT_SORT} from 'sentry/views/dashboards/manage/settings';
import {getIsOnlyPrebuilt} from 'sentry/views/dashboards/manage/utils/getIsOnlyPrebuilt';
import {DashboardFilter, PREBUILT_DASHBOARD_LABEL} from 'sentry/views/dashboards/types';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {isPrimaryNavigationLinkActive} from 'sentry/views/navigation/primary/components';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {DashboardsNavigationItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavigationItems';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

function DashboardsSecondaryNavigationImpl() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;
  const {projects} = useProjects();
  const user = useUser();

  const location = useLocation();
  const {data: starredDashboards = []} = useGetStarredDashboards();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const hasUserLastVisited = organization.features.includes(
    'dashboards-user-last-visited'
  );
  const urlFilter = decodeScalar(location.query.filter) as DashboardFilter | undefined;
  const isOnlyPrebuilt = getIsOnlyPrebuilt(hasPrebuiltDashboards, urlFilter);
  const isOnDashboardsList = isPrimaryNavigationLinkActive(
    `${baseUrl}/`,
    location.pathname,
    {
      end: true,
    }
  );

  useLLMContext({
    contextHint: 'The Dashboards secondary nav panel and the starred dashboard list.',
    hasPrebuiltDashboards,
    starredDashboards: starredDashboards.map(dashboard => ({
      id: dashboard.id,
      title: dashboard.title,
      projects: dashboard.projects ?? [],
    })),
  });

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Dashboards')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="dashboards-all">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/`}
                end
                isActive={isOnDashboardsList && !isOnlyPrebuilt}
                analyticsItemName="dashboards_all_combined"
              >
                {t('All Dashboards')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            {hasPrebuiltDashboards ? (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={
                    hasUserLastVisited
                      ? `${baseUrl}/?filter=${DashboardFilter.ONLY_PREBUILT}`
                      : `${baseUrl}/?filter=${DashboardFilter.ONLY_PREBUILT}&sort=${DEFAULT_PREBUILT_SORT}`
                  }
                  isActive={isOnDashboardsList && isOnlyPrebuilt}
                  analyticsItemName="dashboards_sentry_built"
                >
                  {PREBUILT_DASHBOARD_LABEL}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            ) : null}
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        {starredDashboards.length > 0 ? (
          <Fragment>
            <SecondaryNavigation.Separator />
            <SecondaryNavigation.Section
              id="dashboards-starred"
              title={t('Starred Dashboards')}
            >
              <ErrorBoundary mini>
                {organization.features.includes('dashboards-starred') ? (
                  <DashboardsNavigationItems dashboards={starredDashboards} />
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
          </Fragment>
        ) : null}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

export const DashboardsSecondaryNavigation = registerLLMContext(
  'navigation',
  DashboardsSecondaryNavigationImpl
);

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
  return (
    <SecondaryNavigation.List>
      {dashboards.map(dashboard => {
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
          <SecondaryNavigation.ListItem key={dashboard.id}>
            <SecondaryNavigation.Link
              to={`/organizations/${organizationSlug}/dashboard/${dashboard.id}/`}
              analyticsItemName="dashboard_starred_item"
              leadingItems={
                <SecondaryNavigation.ProjectIcon
                  projectPlatforms={dashboardProjectPlatforms}
                  allProjects={
                    dashboard.projects?.length === 1 && dashboard.projects[0] === -1
                  }
                />
              }
            >
              {dashboard.title}
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        );
      })}
    </SecondaryNavigation.List>
  );
}
