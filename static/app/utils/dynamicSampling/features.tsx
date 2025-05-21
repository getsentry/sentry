import type {Organization} from 'sentry/types/organization';

export function hasDynamicSamplingCustomFeature(organization: Organization) {
  return (
    organization.features.includes('dynamic-samplin') &&
    organization.features.includes('dynamic-sampling-custom')
  );
}
export function hasDynamicSamplingFeature(organization: Organization) {
  return organization.features.includes('dynamic-sampling');
}
