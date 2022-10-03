import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useOrganizationStats} from 'sentry/utils/useOrganizationStats';
import {getClientSampleRates} from 'sentry/views/settings/project/server-side-sampling/utils';

type Props = {
  organization: Organization;
  /**
   * The project that the user is currently viewing.
   * If there are more projects selected, this shall be undefined.
   */
  selectedProject?: Project;
};

export function DynamicSamplingAlert({organization, selectedProject}: Props) {
  const organizationStats = useOrganizationStats({
    organizationSlug: organization.slug,
    queryParameters: {
      project: selectedProject?.id,
      category: 'transaction',
      field: 'sum(quantity)',
      interval: '1h',
      statsPeriod: '48h',
      groupBy: 'outcome',
    },
    queryOptions: {
      enabled:
        // Only show if user has write access and a project is selected
        organization.access.includes('project:write') && defined(selectedProject?.id),
      staleTime: 1000 * 60 * 60, // a request will be considered fresh (or not stale) for 1 hour, dismissing the need for a new request
    },
  });

  const {diff: clientSamplingDiff} = getClientSampleRates(organizationStats.data);

  const recommendChangingClientSdk =
    defined(clientSamplingDiff) && clientSamplingDiff >= 50;

  const showAlert =
    organization.features.includes('server-side-sampling') &&
    organization.features.includes('server-side-sampling-ui') &&
    organization.features.includes('dynamic-sampling-performance-cta') &&
    defined(selectedProject) &&
    recommendChangingClientSdk;

  if (!showAlert) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      trailingItems={
        <Button
          priority="link"
          borderless
          href={`/settings/${organization.slug}/projects/${selectedProject.slug}/server-side-sampling/set-global-sample-rate/?referrer=performance.rate-alert`}
        >
          {t('Adjust Sample Rates')}
        </Button>
      }
    >
      {t(
        'The accuracy of performance metrics can be improved by adjusting your client-side sample rate.'
      )}
    </Alert>
  );
}
