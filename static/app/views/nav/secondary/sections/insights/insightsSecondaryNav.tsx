import {Fragment, useMemo} from 'react';
import partition from 'lodash/partition';

import Feature from 'sentry/components/acl/feature';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
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
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function InsightsSecondaryNav() {
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
            trailingItems={<FeatureBadge type="new" />}
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
          <SecondaryNav.Item to={`${baseUrl}/crons/`} analyticsItemName="insights_crons">
            {t('Crons')}
          </SecondaryNav.Item>
          <Feature features={['uptime']}>
            <SecondaryNav.Item
              to={`${baseUrl}/uptime/`}
              analyticsItemName="insights_uptime"
            >
              {t('Uptime')}
            </SecondaryNav.Item>
          </Feature>
        </SecondaryNav.Section>
        <SecondaryNav.Section id="insights-projects-all">
          <SecondaryNav.Item
            to={`${baseUrl}/projects/`}
            end
            analyticsItemName="insights_projects_all"
          >
            {t('All Projects')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        {projectsToDisplay.length > 0 ? (
          <SecondaryNav.Section
            id="insights-starred-projects"
            title={displayStarredProjects ? t('Starred Projects') : t('Projects')}
          >
            {projectsToDisplay.map(project => (
              <SecondaryNav.Item
                key={project.id}
                to={`${baseUrl}/projects/${project.slug}/`}
                leadingItems={
                  <ProjectIcon
                    projectPlatforms={project.platform ? [project.platform] : ['default']}
                  />
                }
                analyticsItemName="insights_project_starred"
              >
                {project.slug}
              </SecondaryNav.Item>
            ))}
          </SecondaryNav.Section>
        ) : null}
      </SecondaryNav.Body>
    </Fragment>
  );
}
