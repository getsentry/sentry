import useOrganization from 'sentry/utils/useOrganization';

import SeerOnboardingLegacy from './onboardingLegacy';
import SeerOnboardingSeatBased from './onboardingSeatBased';

/**
 * Depending on user's billing, will show either the legacy onboarding, or the newer, seat-based onboarding.
 */
export default function SeerOnboarding() {
  const organization = useOrganization();

  if (organization.features.includes('seat-based-seer-enabled')) {
    return <SeerOnboardingSeatBased />;
  }

  return <SeerOnboardingLegacy />;
}
