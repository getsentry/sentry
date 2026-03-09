import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {
  AGENTS_LANDING_SUB_PATH,
  AGENTS_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/agents/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MCP_LANDING_SUB_PATH,
  MCP_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/mcp/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function InsightsSecondaryNav() {
  const user = useUser();
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  const shouldRedirectToMonitors =
    organization.features.includes('workflow-engine-ui') && !user?.isStaff;

  return (
    <Fragment>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.INSIGHTS].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section id="insights-main">
          <SecondaryNav.Item
            to={`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`}
            analyticsItemName="insights_frontend"
          >
            {FRONTEND_SIDEBAR_LABEL}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            to={`${baseUrl}/${BACKEND_LANDING_SUB_PATH}/`}
            analyticsItemName="insights_backend"
          >
            {BACKEND_SIDEBAR_LABEL}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            to={`${baseUrl}/${MOBILE_LANDING_SUB_PATH}/`}
            analyticsItemName="insights_mobile"
          >
            {MOBILE_SIDEBAR_LABEL}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <SecondaryNav.Section id="insights-ai" title={t('AI')}>
          <SecondaryNav.Item
            to={`${baseUrl}/${AGENTS_LANDING_SUB_PATH}/`}
            analyticsItemName="insights_agents"
          >
            {AGENTS_SIDEBAR_LABEL}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            to={`${baseUrl}/${MCP_LANDING_SUB_PATH}/`}
            analyticsItemName="insights_mcp"
          >
            {MCP_SIDEBAR_LABEL}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <SecondaryNav.Section id="insights-monitors">
          <SecondaryNav.Item
            to={
              shouldRedirectToMonitors
                ? `${makeMonitorBasePathname(organization.slug)}crons/?insightsRedirect=true`
                : `${baseUrl}/crons/`
            }
            analyticsItemName="insights_crons"
          >
            {t('Crons')}
          </SecondaryNav.Item>
          <Feature features={['uptime']}>
            <SecondaryNav.Item
              to={
                shouldRedirectToMonitors
                  ? `${makeMonitorBasePathname(organization.slug)}uptime/?insightsRedirect=true`
                  : `${baseUrl}/uptime/`
              }
              analyticsItemName="insights_uptime"
            >
              {t('Uptime')}
            </SecondaryNav.Item>
          </Feature>
        </SecondaryNav.Section>
      </SecondaryNav.Body>
    </Fragment>
  );
}
