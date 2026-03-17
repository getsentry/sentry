import {Fragment, useMemo} from 'react';
import partition from 'lodash/partition';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
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
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

export function InsightsSecondaryNavigation() {
  const user = useUser();
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  const {projects} = useProjects();

  const [starredProjects, nonStarredProjects] = useMemo(() => {
    return partition(projects, project => project.isBookmarked);
  }, [projects]);

  const displayStarredProjects = starredProjects.length > 0;
  const projectsToDisplay = displayStarredProjects
    ? starredProjects.slice(0, 8)
    : nonStarredProjects.filter(project => project.isMember).slice(0, 8);

  const shouldRedirectToMonitors =
    organization.features.includes('workflow-engine-ui') && !user?.isStaff;

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
                  shouldRedirectToMonitors
                    ? `${makeMonitorBasePathname(organization.slug)}crons/?insightsRedirect=true`
                    : `${baseUrl}/crons/`
                }
                analyticsItemName="insights_crons"
              >
                {t('Crons')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <Feature features={['uptime']}>
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={
                    shouldRedirectToMonitors
                      ? `${makeMonitorBasePathname(organization.slug)}uptime/?insightsRedirect=true`
                      : `${baseUrl}/uptime/`
                  }
                  analyticsItemName="insights_uptime"
                >
                  {t('Uptime')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Separator />
        <SecondaryNavigation.Section id="insights-projects-all">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/projects/`}
                end
                analyticsItemName="insights_projects_all"
              >
                {t('All Projects')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        {projectsToDisplay.length > 0 ? (
          <Fragment>
            <SecondaryNavigation.Separator />
            <SecondaryNavigation.Section
              id="insights-starred-projects"
              title={displayStarredProjects ? t('Starred Projects') : t('Projects')}
            >
              <SecondaryNavigation.List>
                {projectsToDisplay.map(project => (
                  <SecondaryNavigation.ListItem key={project.id}>
                    <SecondaryNavigation.Link
                      to={`${baseUrl}/projects/${project.slug}/`}
                      leadingItems={
                        <SecondaryNavigation.ProjectIcon
                          projectPlatforms={
                            project.platform ? [project.platform] : ['default']
                          }
                        />
                      }
                      analyticsItemName="insights_project_starred"
                    >
                      {project.slug}
                    </SecondaryNavigation.Link>
                  </SecondaryNavigation.ListItem>
                ))}
              </SecondaryNavigation.List>
            </SecondaryNavigation.Section>
          </Fragment>
        ) : null}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
