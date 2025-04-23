import {useMemo} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {LinkButton} from 'sentry/components/core/button';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
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
import {useIsProjectDetailsRedirectActive} from 'sentry/views/insights/pages/platform/shared/projectDetailsRedirect';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

export function InsightsSecondaryNav() {
  const organization = useOrganization();
  const location = useLocation();
  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;
  const isProjectDetailsRedirectActive = useIsProjectDetailsRedirectActive();

  const {projects} = useProjects();

  const [starredProjects, nonStarredProjects] = useMemo(() => {
    return partition(projects, project => project.isBookmarked);
  }, [projects]);

  const isSingleProjectSelected =
    typeof location.query.project === 'string' && location.query.project !== '-1';

  function isProjectSelectedExclusively(project: Project) {
    return isSingleProjectSelected && location.query.project === project.id;
  }

  const displayStarredProjects = starredProjects.length > 0;
  const projectsToDisplay = displayStarredProjects
    ? starredProjects.slice(0, 8)
    : nonStarredProjects.filter(project => project.isMember).slice(0, 8);

  return (
    <SecondaryNav>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.INSIGHTS].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section>
          <SecondaryNav.Item
            isActive={
              !isProjectDetailsRedirectActive &&
              isLinkActive(`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`, location.pathname)
            }
            to={`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`}
            analyticsItemName="insights_frontend"
          >
            {FRONTEND_SIDEBAR_LABEL}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            isActive={
              !isProjectDetailsRedirectActive &&
              isLinkActive(`${baseUrl}/${BACKEND_LANDING_SUB_PATH}/`, location.pathname)
            }
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
          <SecondaryNav.Item
            to={`${baseUrl}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
            analyticsItemName="insights_ai"
          >
            {AI_SIDEBAR_LABEL}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <SecondaryNav.Section
          title={displayStarredProjects ? t('Starred Projects') : t('Projects')}
          trailingItems={
            <AddProjectButtonLink
              to={makeProjectsPathname({path: '/new/', orgSlug: organization.slug})}
              icon={<IconAdd />}
              size="zero"
              borderless
              aria-label={t('Add Project')}
              analyticsEventKey="navigation.add_project_clicked"
              analyticsEventName="Navigation: Add Project Clicked"
            />
          }
        >
          {projectsToDisplay.map(project => (
            <SecondaryNav.Item
              key={project.id}
              to={`${baseUrl}/projects/${project.slug}/`}
              isActive={
                isProjectDetailsRedirectActive
                  ? isProjectSelectedExclusively(project)
                  : undefined
              }
              leadingItems={
                <StyledProjectIcon
                  projectPlatforms={project.platform ? [project.platform] : ['default']}
                />
              }
              analyticsItemName="insights_project_starred"
            >
              {project.slug}
            </SecondaryNav.Item>
          ))}
          <SecondaryNav.Item
            to={`${baseUrl}/projects/`}
            end
            analyticsItemName="insights_projects_all"
          >
            {t('All Projects')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}

const StyledProjectIcon = styled(ProjectIcon)`
  margin-right: ${space(0.75)};
`;

const AddProjectButtonLink = styled(LinkButton)`
  padding: ${space(0.5)};
  margin-right: -${space(0.5)};
  color: ${p => p.theme.subText};
`;
