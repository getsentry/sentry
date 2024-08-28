import type {Organization} from 'sentry/types/organization';

export function hasInsightsAlerts(organization: Organization): boolean {
  return (
    organization.features.includes('insights-initial-modules') &&
    organization.features.includes('insights-alerts')
  );
}
