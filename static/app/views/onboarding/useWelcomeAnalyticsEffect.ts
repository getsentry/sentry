import {useEffect} from 'react';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {ONBOARDING_WELCOME_SCREEN_SOURCE} from 'sentry/views/onboarding/consts';

export function useWelcomeAnalyticsEffect() {
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();

  useEffect(() => {
    trackAnalytics('growth.onboarding_start_onboarding', {
      organization,
      source: ONBOARDING_WELCOME_SCREEN_SOURCE,
    });

    if (onboardingContext.selectedPlatform) {
      // At this point the selectedSDK shall be undefined but just in case, cleaning this up here too
      onboardingContext.setSelectedPlatform(undefined);
    }
  }, [organization, onboardingContext]);
}
