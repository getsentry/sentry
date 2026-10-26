import {useEffect} from 'react';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useWelcomeAnalyticsEffect({showAgentSetup}: {showAgentSetup: boolean}) {
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();

  // Kept separate from the cleanup below: the onboarding context value changes
  // identity whenever session state is written, so sharing an effect would let
  // the cleanup re-fire this event.
  useEffect(() => {
    trackAnalytics('onboarding.scm_welcome_step_viewed', {organization});
    if (showAgentSetup) {
      trackAnalytics('onboarding.scm_welcome_agentic_setup_viewed', {
        organization,
      });
    }
  }, [organization, showAgentSetup]);

  useEffect(() => {
    // At this point the selectedSDK shall be undefined but just in case, cleaning this up here too
    if (onboardingContext.selectedPlatform) {
      onboardingContext.resetOnboarding();
    }
  }, [onboardingContext]);
}
