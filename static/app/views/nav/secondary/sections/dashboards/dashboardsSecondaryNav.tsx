import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function DashboardsSecondaryNav() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;

  const starredDashboards = useApiQuery<DashboardListItem[]>(
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
    <SecondaryNav>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.DASHBOARDS].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section>
          <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="dashboards_all">
            {t('All')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <SecondaryNav.Section title={t('Starred Dashboards')}>
          {starredDashboards.data?.map(dashboard => (
            <SecondaryNav.Item
              key={dashboard.id}
              to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
              analyticsItemName="dashboard_starred_item"
            >
              {dashboard.title}
            </SecondaryNav.Item>
          )) ?? null}
        </SecondaryNav.Section>
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}
