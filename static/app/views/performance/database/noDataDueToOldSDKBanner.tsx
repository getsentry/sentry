import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {useIneligibleProjects} from 'sentry/views/performance/database/useIneligibleProjects';

export function NoDataDueToOldSDKBanner() {
  // TODO: Pass in the project IDs that we're fetching
  const ineligibleProjects = useIneligibleProjects({});

  if (ineligibleProjects.length < 1) {
    return null;
  }

  return (
    <Alert type="info" showIcon>
      {tct(
        "You may be missing data due to outdated SDKs. Please refer to Sentry's [documentation:documentation] for more information.",
        {
          documentation: (
            <ExternalLink href="https://docs.sentry.io/product/performance/database/" />
          ),
        }
      )}
    </Alert>
  );
}
