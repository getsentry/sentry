import {Fragment} from 'react';

import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

type DashboardsNavigationProps = {
  children: React.ReactNode;
};

function DashboardsSecondaryNav({children}: DashboardsNavigationProps) {
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
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.DASHBOARDS}>
        <SecondaryNav.Header>
          {NAV_GROUP_LABELS[PrimaryNavGroup.DASHBOARDS]}
        </SecondaryNav.Header>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/`} end>
              {t('All')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          <SecondaryNav.Section title={t('Starred')}>
            {starredDashboards.data?.map(dashboard => (
              <SecondaryNav.Item
                key={dashboard.id}
                to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
              >
                {dashboard.title}
              </SecondaryNav.Item>
            )) ?? null}
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}

export default function DashboardsNavigation({children}: DashboardsNavigationProps) {
  const organization = useOrganization();
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  if (!hasNavigationV2) {
    return children;
  }

  return <DashboardsSecondaryNav>{children}</DashboardsSecondaryNav>;
}
