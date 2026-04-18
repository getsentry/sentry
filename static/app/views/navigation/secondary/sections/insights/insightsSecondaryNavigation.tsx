import {Fragment} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Feature from 'sentry/components/acl/feature';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {ProjectsNavigationItems} from 'sentry/views/navigation/secondary/sections/projects/starredProjectsList';

export function InsightsSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  const hasWorkflowEngineUI = organization.features.includes('workflow-engine-ui');
  const hasInsightsToDashboards = organization.features.includes(
    'insights-to-dashboards-ui-rollout'
  );

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Insights')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="insights-main">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`}
                analyticsItemName="insights_frontend"
              >
                {FRONTEND_SIDEBAR_LABEL}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/${BACKEND_LANDING_SUB_PATH}/`}
                analyticsItemName="insights_backend"
              >
                {BACKEND_SIDEBAR_LABEL}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/${MOBILE_LANDING_SUB_PATH}/`}
                analyticsItemName="insights_mobile"
              >
                {MOBILE_SIDEBAR_LABEL}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Separator />
        <SecondaryNavigation.Section id="insights-ai" title={t('AI')}>
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/${AGENTS_LANDING_SUB_PATH}/`}
                analyticsItemName="insights_agents"
              >
                {AGENTS_SIDEBAR_LABEL}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/${MCP_LANDING_SUB_PATH}/`}
                analyticsItemName="insights_mcp"
              >
                {MCP_SIDEBAR_LABEL}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Separator />
        <SecondaryNavigation.Section id="insights-monitors">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={
                  hasWorkflowEngineUI
                    ? `${makeMonitorBasePathname(organization.slug)}crons/?insightsRedirect=true`
                    : `${baseUrl}/crons/`
                }
                analyticsItemName="insights_crons"
                trailingItems={
                  hasWorkflowEngineUI ? (
                    <Tooltip
                      isHoverable
                      title={
                        <Fragment>
                          <Text as="p">{t('Crons now live under Monitors.')}</Text>
                          <Text as="p">
                            {tct('See the [link:new Crons page here.]', {
                              link: (
                                <Link
                                  to={`${makeMonitorBasePathname(organization.slug)}crons/`}
                                />
                              ),
                            })}
                          </Text>
                        </Fragment>
                      }
                    >
                      <Badge variant="muted">{t('Moved')}</Badge>
                    </Tooltip>
                  ) : null
                }
              >
                {t('Crons')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <Feature features={['uptime']}>
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={
                    hasWorkflowEngineUI
                      ? `${makeMonitorBasePathname(organization.slug)}uptime/?insightsRedirect=true`
                      : `${baseUrl}/uptime/`
                  }
                  analyticsItemName="insights_uptime"
                  trailingItems={
                    hasWorkflowEngineUI ? (
                      <Tooltip
                        isHoverable
                        title={
                          <Fragment>
                            <Text as="p">{t('Uptime now lives under Monitors.')}</Text>
                            <Text as="p">
                              {tct('See the [link:new Uptime page here.]', {
                                link: (
                                  <Link
                                    to={`${makeMonitorBasePathname(organization.slug)}uptime/`}
                                  />
                                ),
                              })}
                            </Text>
                          </Fragment>
                        }
                      >
                        <Badge variant="muted">{t('Moved')}</Badge>
                      </Tooltip>
                    ) : null
                  }
                >
                  {t('Uptime')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        {!hasInsightsToDashboards && (
          <Fragment>
            <SecondaryNavigation.Separator />
            <ProjectsNavigationItems
              allProjectsAnalyticsItemName="insights_projects_all"
              starredAnalyticsItemName="insights_project_starred"
            />
          </Fragment>
        )}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
