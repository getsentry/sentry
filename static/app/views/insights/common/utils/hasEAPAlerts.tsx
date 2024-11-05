import type {Organization} from 'sentry/types/organization';

export function hasEAPAlerts(organization: Organization): boolean {
  return organization.features.includes('alerts-eap');
}
