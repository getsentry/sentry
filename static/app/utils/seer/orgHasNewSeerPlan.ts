import type {Organization} from 'sentry/types/organization';

/**
 * Whether the org pays for Seer on the current pricing, either per seat or
 * per token from its Seer wallet.
 */
export function orgHasNewSeerPlan(organization: Organization) {
  return (
    organization.features.includes('seat-based-seer-enabled') ||
    organization.features.includes('token-billed-seer-enabled')
  );
}
