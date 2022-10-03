import {useEffect} from 'react';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useOrganizationStats} from 'sentry/utils/useOrganizationStats';
import {
  getClientSampleRates,
  isUniformRule,
} from 'sentry/views/settings/project/server-side-sampling/utils';

export const dynamicSamplingMetricsAccuracyMessage = t(
  'The accuracy of performance metrics can be improved by adjusting your client-side sample rate.'
);

type Props = {
  organization: Organization;
  /**
   * The project that the user is currently viewing.
   * If there are more projects selected, this shall be undefined.
   */
  selectedProject?: Project;
};

// This alert will be shown if there is:
// - all the required feature flags are enabled
// - only one project selected
// - the use viewing this has project:write permission
// - if the diff between the current and recommended sample rates is equal or greater than 50%
// - if we don't display other dynamic sampling alerts. According to the code this cans till be shown toegther with global sdk updates alert
export function DynamicSamplingMetricsAccuracyAlert({
  organization,
  selectedProject,
}: Props) {
  const requiredFeatureFlagsEnabled =
    organization.features.includes('server-side-sampling') &&
    organization.features.includes('server-side-sampling-ui') &&
    organization.features.includes('dynamic-sampling-performance-cta');

  const hasAcces = organization.access.includes('project:write');

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
        // Only show if all required feature flags are enabled, user has write access and a project is selected
        requiredFeatureFlagsEnabled && hasAcces && !!selectedProject?.id,
      staleTime: 1000 * 60 * 60, // a request will be considered fresh (or not stale) for 1 hour, dismissing the need for a new request
    },
  });

  const {diff: clientSamplingDiff} = getClientSampleRates(organizationStats.data);

  const recommendChangingClientSdk =
    defined(clientSamplingDiff) && clientSamplingDiff >= 50;

  const showAlert =
    requiredFeatureFlagsEnabled && !!selectedProject && recommendChangingClientSdk;

  useEffect(() => {
    if (!recommendChangingClientSdk || !selectedProject?.id) {
      return;
    }

    trackAdvancedAnalyticsEvent('sampling.sdk.client.rate.change.alert', {
      organization,
      project_id: selectedProject.id,
    });
  }, [recommendChangingClientSdk, organization, selectedProject?.id]);

  if (!showAlert) {
    return null;
  }

  const dynamicSamplingRules = selectedProject.dynamicSampling?.rules ?? [];
  const uniformRule = dynamicSamplingRules.find(isUniformRule);

  const buttonUrl = !uniformRule
    ? `/settings/${organization.slug}/projects/${selectedProject.slug}/dynamic-sampling/rules/new/?referrer=performance.rate-alert`
    : `/settings/${organization.slug}/projects/${selectedProject.slug}/dynamic-sampling/rules/${uniformRule.id}/?referrer=performance.rate-alert`;

  return (
    <Alert
      type="warning"
      showIcon
      trailingItems={
        <Button priority="link" borderless href={buttonUrl}>
          {t('Adjust Sample Rates')}
        </Button>
      }
    >
      {dynamicSamplingMetricsAccuracyMessage}
    </Alert>
  );
}
