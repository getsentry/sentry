import {useEffect} from 'react';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

type Props = {
  isProjectIncompatible: boolean;
  organization: Organization;
  projectId: Project['id'];
};

export function SamplingProjectIncompatibleAlert({
  isProjectIncompatible,
  organization,
  projectId,
}: Props) {
  useEffect(() => {
    if (isProjectIncompatible) {
      trackAdvancedAnalyticsEvent('sampling.sdk.incompatible.alert', {
        organization,
        project_id: projectId,
      });
    }
  }, [isProjectIncompatible, organization, projectId]);

  if (!isProjectIncompatible) {
    return null;
  }

  return (
    <Alert
      data-test-id="incompatible-project-alert"
      type="error"
      showIcon
      trailingItems={
        <Button
          href={`${SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#current-limitations`}
          priority="link"
          borderless
          external
        >
          {t('Learn More')}
        </Button>
      }
    >
      {t('Your project is currently incompatible with Dynamic Sampling.')}
    </Alert>
  );
}
