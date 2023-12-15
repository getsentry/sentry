import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useDenylistedProjects} from 'sentry/views/performance/database/useDenylistedProjects';
import {useOutdatedSDKProjects} from 'sentry/views/performance/database/useOutdatedSDKProjects';

interface Props {
  Wrapper?: React.ComponentType;
  isDataAvailable?: boolean;
}

function DivWrapper(props) {
  return <div {...props} />;
}

export function NoDataMessage({Wrapper = DivWrapper, isDataAvailable}: Props) {
  const {selection, isReady: pageFilterIsReady} = usePageFilters();

  const selectedProjectIds = selection.projects.map(projectId => projectId.toString());

  const {projects: outdatedProjects, isFetching: areOutdatedProjectsFetching} =
    useOutdatedSDKProjects({
      projectId: selectedProjectIds,
      enabled: pageFilterIsReady && !isDataAvailable,
    });

  const {projects: denylistedProjects} = useDenylistedProjects({
    projectId: selectedProjectIds,
  });

  // Hide message while fetching outdated projects
  if (areOutdatedProjectsFetching) {
    return null;
  }

  // Hide message if all conditions are satisfied
  if (
    isDataAvailable &&
    outdatedProjects.length === 0 &&
    denylistedProjects.length === 0
  ) {
    return null;
  }

  return (
    <Wrapper>
      {!isDataAvailable &&
        tct(
          'No queries found. Try updating your filters, or learn more about performance monitoring for queries in our [documentation:documentation].',
          {
            documentation: (
              <ExternalLink href="https://docs.sentry.io/product/performance/queries/" />
            ),
          }
        )}{' '}
      {outdatedProjects.length > 0 &&
        tct('You may be missing data due to outdated SDKs: [projectList]', {
          projectList: <ProjectList projects={outdatedProjects} />,
        })}{' '}
      {denylistedProjects.length > 0 &&
        tct(
          'Some of your projects have been omitted from metrics extraction. Please contact [support]. Omitted projects: [projectList]',
          {
            support: <ExternalLink href="https://sentry.io/support/" />,
            projectList: <ProjectList projects={denylistedProjects} />,
          }
        )}
    </Wrapper>
  );
}

interface ProjectListProps {
  projects: Project[];
  limit?: number;
}

function ProjectList({projects, limit = MAX_LISTED_PROJECTS}: ProjectListProps) {
  const organization = useOrganization();

  const visibleProjects = projects.slice(0, limit + 1);
  const hasMoreProjectsThanVisible = projects.length > MAX_LISTED_PROJECTS;

  return (
    <Fragment>
      {visibleProjects.slice(0, limit).map((project, projectIndex) => {
        return (
          <span key={project.id}>
            <a
              href={normalizeUrl(
                `/organizations/${organization.slug}/projects/${project.slug}/`
              )}
            >
              {project.name}
            </a>
            {projectIndex < visibleProjects.length - 1 && ', '}
          </span>
        );
      })}
      {hasMoreProjectsThanVisible &&
        tct(' and [count] more.', {
          count: projects.length - limit,
        })}{' '}
    </Fragment>
  );
}

const MAX_LISTED_PROJECTS = 3;
