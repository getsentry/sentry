import type {Organization} from 'sentry/types/organization';

/**
 * This hook determines if we should show the new Seer settings/onboarding or not.
 *
 * This is based on the following factors:
 *  - The organization is on the new Seer, seat-based plan
 *  - The organization is on the old Seer plan
 *  - The organization is on the code-review-beta trial
 *  - If the new Seer billing is released
 */
export default function showNewSeer(organization: Organization) {
  // New seer plan
  if (organization.features.includes('seat-based-seer-enabled')) {
    return true;
  }

  // Old seer plan
  if (organization.features.includes('seer-added')) {
    return false;
  }

  // This is the launch flag
  if (
    organization.features.includes('seer-user-billing') &&
    organization.features.includes('seer-user-billing-launch')
  ) {
    return true;
  }

  return false;
}
