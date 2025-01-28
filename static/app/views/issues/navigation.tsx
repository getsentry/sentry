import {Fragment} from 'react';

import {SecondaryNav} from 'sentry/components/nav/secondary';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';

interface IssuesWrapperProps extends RouteComponentProps<{}, {}> {
  children: React.ReactNode;
}

export function IssueNavigation({children}: IssuesWrapperProps) {
  const organization = useOrganization();
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  if (!hasNavigationV2) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/issues`;

  return (
    <Fragment>
      <SecondaryNav>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={baseUrl}>{t('All')}</SecondaryNav.Item>
            {/* TODO(malwilley): Move feedback under the /issues/ route */}
            <SecondaryNav.Item to={`/organizations/${organization.slug}/feedback/`}>
              {t('Feedback')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </SecondaryNav.Body>
        <SecondaryNav.Footer>
          {/* TODO(malwilley): Move alerts under the /issues/ route */}
          <SecondaryNav.Item to={`/organizations/${organization.slug}/alerts/`}>
            {t('Alerts')}
          </SecondaryNav.Item>
        </SecondaryNav.Footer>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}
