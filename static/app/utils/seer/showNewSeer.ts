import type {Organization} from 'sentry/types/organization';

import {orgHasNewSeerPlan} from './orgHasNewSeerPlan';

/**
 * This hook determines if we should show the new Seer settings/onboarding or not.
 *
 * This is based on the following factors:
 *  - The organization is on the new seat-based or token-billed Seer plan. This supersedes all other checks.
 *  - The organization is on the old Seer plan
 *  - If the new Seer billing is released
 */
export function showNewSeer(organization: Organization) {
  // New seer plan
  if (orgHasNewSeerPlan(organization)) {
    return true;
  }

  // Old seer plan
  if (organization.features.includes('seer-added')) {
    return false;
  }

  // This is the launch flag
  if (organization.features.includes('seer-user-billing-launch')) {
    return true;
  }

  return false;
}
