import type {Organization} from 'sentry/types/organization';

export function hasEAPAlerts(organization: Organization): boolean {
  return organization.features.includes('visibility-explore-view');
}

export function deprecateTransactionAlerts(organization: Organization): boolean {
  return organization.features.includes('performance-transaction-deprecation-alerts');
}
