import {Fragment, useMemo} from 'react';
import partition from 'lodash/partition';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

interface ProjectsNavigationItemsProps {
  allProjectsAnalyticsItemName?: string;
  starredAnalyticsItemName?: string;
}

function ProjectsNavigationItemsImpl({
  allProjectsAnalyticsItemName = 'projects_all',
  starredAnalyticsItemName = 'project_starred',
}: ProjectsNavigationItemsProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const [starredProjects, nonStarredProjects] = useMemo(() => {
    return partition(projects, project => project.isBookmarked);
  }, [projects]);

  const displayStarredProjects = starredProjects.length > 0;
  const projectsToDisplay = displayStarredProjects
    ? starredProjects.slice(0, 8)
    : nonStarredProjects.filter(project => project.isMember).slice(0, 8);

  useLLMContext({
    contextHint:
      'The (starred) projects list shown in a secondary nav panel — Projects ' +
      "itself, or Insights' project shortcut section.",
    isDisplayingStarred: displayStarredProjects,
    projects: projectsToDisplay.map(project => ({
      id: project.id,
      slug: project.slug,
      platform: project.platform,
    })),
  });

  return (
    <Fragment>
      <SecondaryNavigation.Section id="projects-all">
        <SecondaryNavigation.List>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link
              to={makeProjectsPathname({path: '/', organization})}
              end
              analyticsItemName={allProjectsAnalyticsItemName}
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
            id="starred-projects"
            title={displayStarredProjects ? t('Starred Projects') : t('Projects')}
          >
            <SecondaryNavigation.List>
              {projectsToDisplay.map(project => (
                <SecondaryNavigation.ListItem key={project.id}>
                  <SecondaryNavigation.Link
                    to={makeProjectsPathname({
                      path: `/${project.slug}/`,
                      organization,
                    })}
                    leadingItems={
                      <SecondaryNavigation.ProjectIcon
                        projectPlatforms={
                          project.platform ? [project.platform] : ['default']
                        }
                      />
                    }
                    analyticsItemName={starredAnalyticsItemName}
                  >
                    {project.slug}
                  </SecondaryNavigation.Link>
                </SecondaryNavigation.ListItem>
              ))}
            </SecondaryNavigation.List>
          </SecondaryNavigation.Section>
        </Fragment>
      ) : null}
    </Fragment>
  );
}

export const ProjectsNavigationItems = registerLLMContext(
  'navigation',
  ProjectsNavigationItemsImpl
);
