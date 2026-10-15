import type {Organization} from 'sentry/types/organization';

export function hasDynamicSamplingFeature(organization: Organization) {
  return organization.features.includes('dynamic-sampling');
}
