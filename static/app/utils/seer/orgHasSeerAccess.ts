import type {Organization} from 'sentry/types/organization';

/**
 * Whether the org can use Autofix: AI features are allowed (as in
 * `useOrganizationSeerSetup`) and the plan includes Seer, seat-based or legacy.
 */
export function orgHasSeerAccess(organization: Organization) {
  return (
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    (organization.features.includes('seat-based-seer-enabled') ||
      organization.features.includes('seer-added'))
  );
}
