import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';

// These labels need to be exported so that they can be used in audit logs
export const retentionPrioritiesLabels = {
  boostLatestRelease: t('Prioritize new releases'),
  boostEnvironments: t('Prioritize dev environments'),
  boostLowVolumeTransactions: t('Prioritize low-volume transactions'),
  ignoreHealthChecks: t('Deprioritize health checks'),
  minimumSampleRate: t('Always use project sample rate'),
};

type RetentionPriorityField = {
  hintText: string;
  label: string;
  name: DynamicSamplingBiasType;
};

export function getRetentionPriorityFields(
  organization: Organization
): RetentionPriorityField[] {
  return [
    {
      name: DynamicSamplingBiasType.BOOST_LATEST_RELEASES,
      label: retentionPrioritiesLabels.boostLatestRelease,
      hintText: t(
        'Captures more transactions for your new releases as they are being adopted'
      ),
    },
    {
      name: DynamicSamplingBiasType.BOOST_ENVIRONMENTS,
      label: retentionPrioritiesLabels.boostEnvironments,
      hintText: t(
        'Captures more traces from environments that contain "debug", "dev", "local", "qa", and "test"'
      ),
    },
    {
      name: DynamicSamplingBiasType.BOOST_LOW_VOLUME_TRANSACTIONS,
      label: retentionPrioritiesLabels.boostLowVolumeTransactions,
      hintText: t(
        "Balance high-volume endpoints so they don't drown out low-volume ones"
      ),
    },
    {
      name: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS,
      label: retentionPrioritiesLabels.ignoreHealthChecks,
      hintText: t('Captures fewer of your health checks transactions'),
    },
    ...(hasDynamicSamplingCustomFeature(organization) &&
    organization.features.includes('dynamic-sampling-minimum-sample-rate')
      ? [
          {
            name: DynamicSamplingBiasType.MINIMUM_SAMPLE_RATE,
            label: retentionPrioritiesLabels.minimumSampleRate,
            hintText: t(
              'If higher than the trace sample rate, use the project sample rate for spans instead of the trace sample rate.'
            ),
          },
        ]
      : []),
  ];
}
