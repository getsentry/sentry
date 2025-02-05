import {Fragment} from 'react';

import {SecondaryNav} from 'sentry/components/nav/secondary';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type DashboardsNavigationProps = {
  children: React.ReactNode;
};

export default function DashboardsNavigation({children}: DashboardsNavigationProps) {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/dashboards`;

  return (
    <Fragment>
      <SecondaryNav>
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
