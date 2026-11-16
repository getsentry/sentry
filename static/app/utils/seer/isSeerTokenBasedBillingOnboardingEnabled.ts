import type {Organization} from 'sentry/types/organization';

export function isSeerTokenBasedBillingOnboardingEnabled(organization: Organization) {
  return (
    organization.features.includes('seer-token-based-billing-onboarding') &&
    organization.features.includes('token-billed-seer-enabled')
  );
}
