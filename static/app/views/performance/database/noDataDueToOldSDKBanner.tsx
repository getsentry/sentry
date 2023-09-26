import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useIneligibleProjects} from 'sentry/views/performance/database/useIneligibleProjects';

export function NoDataDueToOldSDKBanner() {
  // TODO: Check whether the data is actually missing
  const {selection, isReady: pageFilterIsReady} = usePageFilters();

  const ineligibleProjects = useIneligibleProjects({
    projectId: pageFilterIsReady
      ? selection.projects.map(projectId => projectId.toString())
      : undefined,
    enabled: pageFilterIsReady,
  });
  const organization = useOrganization();

  const hasMoreIneligibleProjectsThanVisible =
    ineligibleProjects.length > MAX_LISTED_PROJECTS;

  if (ineligibleProjects.length < 1) {
    return null;
  }

  return (
    <Alert type="info" showIcon>
      {tct(
        "You may be missing data due to outdated SDKs. Please refer to Sentry's [documentation:documentation] for more information. Projects with outdated SDKs: [projectList]",
        {
          documentation: (
            <ExternalLink href="https://docs.sentry.io/product/performance/database/" />
          ),
          projectList: (
            <Fragment>
              {ineligibleProjects.slice(0, MAX_LISTED_PROJECTS).map(project => {
                return (
                  <span key={project.id}>
                    <a
                      href={normalizeUrl(
                        `/organizations/${organization.slug}/projects/${project.slug}/`
                      )}
                    >
                      {project.name}
                    </a>
                  </span>
                );
              })}
            </Fragment>
          ),
        }
      )}
      {hasMoreIneligibleProjectsThanVisible
        ? t('and [count] more', {count: ineligibleProjects.length - MAX_LISTED_PROJECTS})
        : ''}
    </Alert>
  );
}

const MAX_LISTED_PROJECTS = 3;
