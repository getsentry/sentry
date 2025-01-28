import type {Organization} from 'sentry/types/organization';

export function hasTempestAccess(organization: Organization) {
  return organization.features.includes('tempest-access');
}
