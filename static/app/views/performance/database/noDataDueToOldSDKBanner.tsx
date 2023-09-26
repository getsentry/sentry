import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useIneligibleProjects} from 'sentry/views/performance/database/useIneligibleProjects';

export function NoDataDueToOldSDKBanner() {
  // TODO: Pass in the project IDs that we're fetching
  const ineligibleProjects = useIneligibleProjects({});
  const organization = useOrganization();

  if (ineligibleProjects.length < 1) {
    return null;
  }

  return (
    <Alert type="info" showIcon>
      {tct(
        "You may be missing data due to outdated SDKs. Please refer to Sentry's [documentation:documentation] for more information. Projects with outdated SDKs: [projectList] ",
        {
          documentation: (
            <ExternalLink href="https://docs.sentry.io/product/performance/database/" />
          ),
          projectList: (
            <ul>
              {ineligibleProjects.slice(0, MAX_LISTED_PROJECTS).map(project => {
                return (
                  <li key={project.id}>
                    <a
                      href={normalizeUrl(
                        `/organizations/${organization.slug}/projects/${project.slug}/`
                      )}
                    >
                      {project.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          ),
        }
      )}
    </Alert>
  );
}

const MAX_LISTED_PROJECTS = 3;
