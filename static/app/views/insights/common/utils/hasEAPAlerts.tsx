/* eslint-disable unicorn/filename-case */
import type {Organization} from 'sentry/types/organization';

export function deprecateTransactionAlerts(organization: Organization): boolean {
  return organization.features.includes('discover-saved-queries-deprecation');
}
