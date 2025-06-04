import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function DashboardsSecondaryNav() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;
  const {projects} = useProjects();

  const {data: starredDashboards = []} = useApiQuery<DashboardListItem[]>(
    [
      `/organizations/${organization.slug}/dashboards/`,
      {
        query: {
          filter: 'onlyFavorites',
        },
      },
    ],
    {
      staleTime: Infinity,
    }
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
        {starredDashboards.length > 0 ? (
          <SecondaryNav.Section id="dashboards-starred" title={t('Starred Dashboards')}>
            {starredDashboards.map(dashboard => {
              const dashboardProjects = new Set(dashboard.projects.map(String));
              const dashboardProjectPlatforms = projects
                .filter(p => dashboardProjects.has(p.id))
                .map(p => p.platform)
                .filter(defined);
              return (
                <SecondaryNav.Item
                  key={dashboard.id}
                  to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
                  analyticsItemName="dashboard_starred_item"
                  leadingItems={
                    <ProjectIcon projectPlatforms={dashboardProjectPlatforms} />
                  }
                >
                  {dashboard.title}
                </SecondaryNav.Item>
              );
            })}
          </SecondaryNav.Section>
        ) : null}
      </SecondaryNav.Body>
    </Fragment>
  );
}
