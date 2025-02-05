import {Fragment} from 'react';

import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AI_LANDING_SUB_PATH,
  AI_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/ai/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

type InsightsNavigationProps = {
  children: React.ReactNode;
};

export default function InsightsNavigation({children}: InsightsNavigationProps) {
  const organization = useOrganization();
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  if (!hasNavigationV2) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.INSIGHTS}>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/projects/`}>
              {t('All Projects')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`}>
              {FRONTEND_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/${BACKEND_LANDING_SUB_PATH}/`}>
              {BACKEND_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/${MOBILE_LANDING_SUB_PATH}/`}>
              {MOBILE_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/${AI_LANDING_SUB_PATH}/`}>
              {AI_SIDEBAR_LABEL}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}
