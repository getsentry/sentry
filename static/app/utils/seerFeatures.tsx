import type {Organization} from 'sentry/types/organization';

/**
 * Checks if Seer Explorer is enabled for the organization.
 * Requires all of the following conditions:
 * - 'seer-explorer' feature flag
 * - Organization has open membership
 * Does not check general AI features access or org consent.
 */
export function isSeerExplorerEnabled(organization: Organization): boolean {
  return organization.openMembership && organization.features.includes('seer-explorer');
}
