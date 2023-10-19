import {Fragment} from 'react';
import sumBy from 'lodash/sumBy';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useIneligibleProjects} from 'sentry/views/performance/database/useIneligibleProjects';
import {useProjectSpanMetricCounts} from 'sentry/views/starfish/queries/useProjectSpanMetricsCounts';

interface Props {
  Wrapper?: React.ComponentType;
}

function DivWrapper(props) {
  return <div {...props} />;
}

export function NoDataMessage({Wrapper = DivWrapper}: Props) {
  const {selection, isReady: pageFilterIsReady} = usePageFilters();

  const selectedProjectIds = selection.projects.map(projectId => projectId.toString());

  const {data: projectSpanMetricsCounts, isLoading} = useProjectSpanMetricCounts({
    query: 'span.module:db',
    statsPeriod: SAMPLE_STATS_PERIOD,
    enabled: pageFilterIsReady,
    projectId: selectedProjectIds,
  });

  const doesAnySelectedProjectHaveMetrics =
    sumBy(projectSpanMetricsCounts, 'count()') > 0;

  const {ineligibleProjects} = useIneligibleProjects({
    projectId: selectedProjectIds,
    enabled: pageFilterIsReady && !doesAnySelectedProjectHaveMetrics,
  });

  const organization = useOrganization();

  const hasMoreIneligibleProjectsThanVisible =
    ineligibleProjects.length > MAX_LISTED_PROJECTS;

  if (isLoading) {
    return null;
  }

  if (doesAnySelectedProjectHaveMetrics) {
    return null;
  }

  const firstIneligibleProjects = ineligibleProjects.slice(0, MAX_LISTED_PROJECTS + 1);

  return (
    <Wrapper>
      {t('No queries found.')}{' '}
      {tct(
        'Try updating your filters, or learn more about performance monitoring for queries in our [documentation:documentation].',
        {
          documentation: (
            <ExternalLink href="https://docs.sentry.io/product/performance/queries/" />
          ),
        }
      )}{' '}
      {ineligibleProjects.length > 0 &&
        tct('You may also be missing data due to outdated SDKs: [projectList]', {
          documentation: (
            <ExternalLink href="https://docs.sentry.io/product/performance/query-insights/" />
          ),
          projectList: (
            <Fragment>
              {firstIneligibleProjects.map((project, projectIndex) => {
                return (
                  <span key={project.id}>
                    <a
                      href={normalizeUrl(
                        `/organizations/${organization.slug}/projects/${project.slug}/`
                      )}
                    >
                      {project.name}
                    </a>
                    {projectIndex < firstIneligibleProjects.length - 1 && ', '}
                  </span>
                );
              })}
            </Fragment>
          ),
        })}
      {hasMoreIneligibleProjectsThanVisible &&
        tct(' and [count] more.', {
          count: ineligibleProjects.length - MAX_LISTED_PROJECTS,
        })}{' '}
    </Wrapper>
  );
}

const MAX_LISTED_PROJECTS = 3;

const SAMPLE_STATS_PERIOD = '14d'; // The time period in which to check for any presence of span metrics
