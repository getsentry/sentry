import type {Organization} from 'sentry/types/organization';

/**
 * Whether the org has access to the Code Review feature.
 * Note that legacy usage-based Seer (`seer-added` only) is excluded.
 */
export function orgHasCodeReviewFeature(organization: Organization) {
  return (
    organization.features.includes('seat-based-seer-enabled') ||
    organization.features.includes('code-review-beta')
  );
}
