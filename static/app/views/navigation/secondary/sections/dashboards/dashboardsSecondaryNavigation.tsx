import {Fragment} from 'react';
import {parseAsStringEnum, useQueryState} from 'nuqs';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {DEFAULT_PREBUILT_SORT} from 'sentry/views/dashboards/manage/settings';
import {getIsOnlyPrebuilt} from 'sentry/views/dashboards/manage/utils/getIsOnlyPrebuilt';
import {
  CUSTOM_DASHBOARD_LABEL,
  DashboardFilter,
  PREBUILT_DASHBOARD_LABEL,
} from 'sentry/views/dashboards/types';
import {isPrimaryNavigationLinkActive} from 'sentry/views/navigation/primary/components';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

import {DashboardsNavigationItems} from './dashboardsNavigationItems';

function DashboardsSecondaryNavigationImpl() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;

  const location = useLocation();
  const {data: starredDashboards = []} = useGetStarredDashboards();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const hasUserLastVisited = organization.features.includes(
    'dashboards-user-last-visited'
  );
  const [urlFilter] = useQueryState(
    'filter',
    parseAsStringEnum(Object.values(DashboardFilter))
  );
  const isOnlyPrebuilt = getIsOnlyPrebuilt(hasPrebuiltDashboards, urlFilter ?? undefined);
  const isOnlyCustom =
    hasPrebuiltDashboards && urlFilter === DashboardFilter.EXCLUDE_PREBUILT;
  const isOnDashboardsList = isPrimaryNavigationLinkActive(
    `${baseUrl}/`,
    location.pathname,
    {end: true}
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
      <SecondaryNavigation.Header>
        <SecondaryNavigation.HeaderTitle>
          {t('Dashboards')}
        </SecondaryNavigation.HeaderTitle>
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="dashboards-all">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/`}
                end
                isActive={isOnDashboardsList && !isOnlyPrebuilt && !isOnlyCustom}
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
            {hasPrebuiltDashboards ? (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/?filter=${DashboardFilter.EXCLUDE_PREBUILT}`}
                  isActive={isOnDashboardsList && isOnlyCustom}
                  analyticsItemName="dashboards_custom"
                >
                  {CUSTOM_DASHBOARD_LABEL}
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
                <DashboardsNavigationItems dashboards={starredDashboards} />
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
