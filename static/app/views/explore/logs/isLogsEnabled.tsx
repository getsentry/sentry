import type {Organization} from 'sentry/types/organization';

export function isLogsEnabled(organization: Organization): boolean {
  return organization.features.includes('ourlogs-enabled');
}
