import {useContext} from 'react';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';

/**
 * Custom hook to access and update the selected SDK in the onboarding process.
 */
export function useOnboardingSDK() {
  const {selectedSDK, setSelectedSDK} = useContext(OnboardingContext);

  return {
    selectedSDK,
    setSelectedSDK,
  };
}
