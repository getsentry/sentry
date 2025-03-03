import {Fragment} from 'react';

import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
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

import {MODULE_BASE_URLS} from './common/utils/useModuleURL';
import {ModuleName} from './types';

type InsightsNavigationProps = {
  children: React.ReactNode;
};

export default function InsightsNavigation({children}: InsightsNavigationProps) {
  const organization = useOrganization();
  const prefersStackedNav = usePrefersStackedNav();

  if (!prefersStackedNav) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.INSIGHTS}>
        <SecondaryNav.Header>
          {NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
        </SecondaryNav.Header>
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
            <SecondaryNav.Item
              to={`${baseUrl}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
            >
              {AI_SIDEBAR_LABEL}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}
