import type {Organization} from 'sentry/types/organization';

export function hasEAPAlerts(organization: Organization): boolean {
  return true;
  return organization.features.includes('alerts-eap');
}
