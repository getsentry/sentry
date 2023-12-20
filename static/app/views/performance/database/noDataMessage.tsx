import {Fragment} from 'react';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
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
  const organization = useOrganization();
  const {selection, isReady: pageFilterIsReady} = usePageFilters();

  const selectedProjectIds = selection.projects.map(projectId => projectId.toString());

  const {projects: outdatedProjects, isFetching: areOutdatedProjectsFetching} =
    useOutdatedSDKProjects({
      projectId: selectedProjectIds,
      enabled: pageFilterIsReady && !isDataAvailable,
    });

  const {projects: denylistedProjects, isFetching: areDenylistProjectsFetching} =
    useDenylistedProjects({
      projectId: selectedProjectIds,
    });

  const isDataFetching = areOutdatedProjectsFetching || areDenylistProjectsFetching;

  if (isDataFetching) {
    return null;
  }

  const hasAnyProblematicProjects =
    (!areOutdatedProjectsFetching && outdatedProjects.length > 0) ||
    (!areDenylistProjectsFetching && denylistedProjects.length > 0);

  if (isDataAvailable && !hasAnyProblematicProjects) {
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
        tct('You may be missing data due to outdated SDKs: [projectList].', {
          projectList: <ProjectList projects={outdatedProjects} />,
        })}{' '}
      {denylistedProjects.length > 0 &&
        tct(
          'Some of your projects have been omitted from query performance analysis. Please [supportLink]. Omitted projects: [projectList].',
          {
            supportLink: (
              <Button priority="link" onClick={() => openHelpSearchModal({organization})}>
                {t('Contact Support')}
              </Button>
            ),
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
