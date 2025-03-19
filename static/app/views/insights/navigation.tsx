import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import ProjectIcon from 'sentry/components/nav/projectIcon';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {isLinkActive} from 'sentry/components/nav/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  AI_LANDING_SUB_PATH,
  AI_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/ai/settings';
import {useIsLaravelInsightsEnabled} from 'sentry/views/insights/pages/backend/laravel/features';
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

const platformsUsingOverviewAsProjectDetails: PlatformKey[] = ['php-laravel'];

function InsightsSecondaryNav({children}: InsightsNavigationProps) {
  const organization = useOrganization();
  const location = useLocation();
  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;
  const [isLaravelInsightsEnabled] = useIsLaravelInsightsEnabled();

  const {projects} = useProjects();

  const [starredProjects, nonStarredProjects] = useMemo(() => {
    return partition(projects, project => project.isBookmarked);
  }, [projects]);

  const isSingleProjectSelected =
    typeof location.query.project === 'string' && location.query.project !== '-1';

  function isProjectSelectedExclusively(project: Project) {
    return isSingleProjectSelected && location.query.project === project.id;
  }

  function isUsingOverviewAsProjectDetails(project: Project) {
    return (
      project.platform &&
      platformsUsingOverviewAsProjectDetails.includes(project.platform) &&
      isLaravelInsightsEnabled
    );
  }

  const isStarredProjectSelected =
    location.query.starred === '1' && isSingleProjectSelected;

  const displayStarredProjects = starredProjects.length > 0;
  const projectsToDisplay = displayStarredProjects
    ? starredProjects.slice(0, 8)
    : nonStarredProjects.filter(project => project.isMember).slice(0, 8);

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.INSIGHTS}>
        <SecondaryNav.Header>
          {NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
        </SecondaryNav.Header>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item
              to={`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`}
              analyticsItemName="insights_frontend"
            >
              {FRONTEND_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              isActive={
                isLinkActive(
                  `${baseUrl}/${BACKEND_LANDING_SUB_PATH}/`,
                  location.pathname
                ) &&
                // The starred param indicates that the overview is being accessed via the starred projects nav item
                (!isStarredProjectSelected || !isLaravelInsightsEnabled)
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
          >
            {projectsToDisplay.map(project => (
              <SecondaryNav.Item
                key={project.id}
                to={
                  isUsingOverviewAsProjectDetails(project)
                    ? {
                        pathname: `${baseUrl}/backend/`,
                        search: `?project=${project.id}&starred=1`,
                      }
                    : `${baseUrl}/projects/${project.slug}/`
                }
                isActive={
                  isUsingOverviewAsProjectDetails(project)
                    ? isLinkActive(`${baseUrl}/backend/`, location.pathname) &&
                      isProjectSelectedExclusively(project) &&
                      isStarredProjectSelected
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
      {children}
    </Fragment>
  );
}

export default function InsightsNavigation({children}: InsightsNavigationProps) {
  const prefersStackedNav = usePrefersStackedNav();

  if (!prefersStackedNav) {
    return children;
  }

  return <InsightsSecondaryNav>{children}</InsightsSecondaryNav>;
}

const StyledProjectIcon = styled(ProjectIcon)`
  margin-right: ${space(0.75)};
`;
