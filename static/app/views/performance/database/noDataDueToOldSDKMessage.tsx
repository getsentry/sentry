import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useIneligibleProjects} from 'sentry/views/performance/database/useIneligibleProjects';
import {useHasAnySpanMetrics} from 'sentry/views/starfish/queries/useHasAnySpanMetrics';

interface Props {
  Wrapper?: React.ComponentType;
}

function DivWrapper(props) {
  return <div {...props} />;
}

export function NoDataDueToOldSDKMessage({Wrapper = DivWrapper}: Props) {
  const {selection, isReady: pageFilterIsReady} = usePageFilters();

  const options = {
    projectId: pageFilterIsReady
      ? selection.projects.map(projectId => projectId.toString())
      : undefined,
    enabled: pageFilterIsReady,
  };

  const {hasMetrics} = useHasAnySpanMetrics(options);
  const {ineligibleProjects} = useIneligibleProjects(options);

  const organization = useOrganization();

  const hasMoreIneligibleProjectsThanVisible =
    ineligibleProjects.length > MAX_LISTED_PROJECTS;

  if (hasMetrics) {
    return null;
  }

  if (ineligibleProjects.length < 1) {
    return null;
  }

  const listedProjects = ineligibleProjects.slice(0, MAX_LISTED_PROJECTS + 1);

  return (
    <Wrapper>
      {tct(
        "You may be missing data due to outdated SDKs. Please refer to Sentry's [documentation:documentation] for more information. Projects with outdated SDKs: [projectList]",
        {
          documentation: (
            <ExternalLink href="https://docs.sentry.io/product/performance/query-insights/" />
          ),
          projectList: (
            <Fragment>
              {listedProjects.map((project, projectIndex) => {
                return (
                  <span key={project.id}>
                    <a
                      href={normalizeUrl(
                        `/organizations/${organization.slug}/projects/${project.slug}/`
                      )}
                    >
                      {project.name}
                    </a>
                    {projectIndex < listedProjects.length - 1 && ', '}
                  </span>
                );
              })}
            </Fragment>
          ),
        }
      )}
      {hasMoreIneligibleProjectsThanVisible
        ? tct(' and [count] more', {
            count: ineligibleProjects.length - MAX_LISTED_PROJECTS,
          })
        : ''}
    </Wrapper>
  );
}

const MAX_LISTED_PROJECTS = 3;
