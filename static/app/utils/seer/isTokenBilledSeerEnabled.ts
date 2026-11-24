import type {Organization} from 'sentry/types/organization';

export function isTokenBilledSeerEnabled(organization: Organization) {
  return organization.features.includes('token-billed-seer-enabled');
}
