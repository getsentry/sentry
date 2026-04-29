import type {Organization} from 'sentry/types/organization';

export function hasPlatformizedInsights(organization: Organization) {
  return organization.features.includes('insights-prebuilt-dashboards');
}
