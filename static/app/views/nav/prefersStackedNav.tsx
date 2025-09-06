import type {Organization} from 'sentry/types/organization';

// IMPORTANT:
// This function and the usePrefersStackedNav hook NEED to have the same logic.
// Make sure to update both if you are changing this logic.

export function prefersStackedNav(_: Organization) {
  return true;
}
