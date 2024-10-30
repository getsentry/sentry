import type {Organization} from 'sentry/types/organization';

export function hasDynamicSamplingCustomFeature(organization: Organization) {
  return (
    true ||
    (organization.features.includes('dynamic-sampling') &&
      organization.features.includes('dynamic-sampling-custom'))
  );
}
