import {Fragment, useMemo} from 'react';
import partition from 'lodash/partition';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

interface ProjectsNavigationItemsProps {
  allProjectsAnalyticsItemName?: string;
  starredAnalyticsItemName?: string;
}

export function ProjectsNavigationItems({
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
