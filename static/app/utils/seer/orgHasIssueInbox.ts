import type {Organization} from 'sentry/types/organization';

export function orgHasIssueInbox(organization: Organization) {
  const hasSeerEntitlement =
    organization.features.includes('seat-based-seer-enabled') ||
    organization.features.includes('seer-added');

  return (
    organization.features.includes('issue-inbox') ||
    (organization.features.includes('issue-inbox-seer-rollout') && hasSeerEntitlement)
  );
}
