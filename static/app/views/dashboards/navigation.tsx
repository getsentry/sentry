import {Fragment} from 'react';

import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type DashboardsNavigationProps = {
  children: React.ReactNode;
};

export default function DashboardsNavigation({children}: DashboardsNavigationProps) {
  const organization = useOrganization();
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  if (!hasNavigationV2) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/dashboards`;

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.DASHBOARDS}>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/`} end>
              {t('All')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}
