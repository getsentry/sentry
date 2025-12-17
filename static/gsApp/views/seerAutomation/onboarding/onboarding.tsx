import showNewSeer from 'sentry/utils/seer/showNewSeer';
import useOrganization from 'sentry/utils/useOrganization';

import SeerOnboardingLegacy from './onboardingLegacy';
import SeerOnboardingSeatBased from './onboardingSeatBased';

/**
 * Depending on user's billing, will show either the legacy onboarding, or the newer, seat-based onboarding.
 */
export default function SeerOnboarding() {
  const organization = useOrganization();

  if (showNewSeer(organization)) {
    return <SeerOnboardingSeatBased />;
  }

  return <SeerOnboardingLegacy />;
}
