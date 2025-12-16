import {useShowNewSeer} from './hooks/useShowNewSeer';
import SeerOnboardingLegacy from './onboardingLegacy';
import SeerOnboardingSeatBased from './onboardingSeatBased';

/**
 * Depending on user's billing, will show either the legacy onboarding, or the newer, seat-based onboarding.
 */
export default function SeerOnboarding() {
  const showNewSeer = useShowNewSeer();

  if (showNewSeer) {
    return <SeerOnboardingSeatBased />;
  }

  return <SeerOnboardingLegacy />;
}
