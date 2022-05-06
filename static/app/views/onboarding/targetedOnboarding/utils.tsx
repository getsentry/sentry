import {useMemo} from 'react';

import {usePersistedStoreCategory} from 'sentry/stores/persistedStore';

import {OnboardingState} from './types';

export function usePersistedOnboardingState(): [
  OnboardingState | null,
  (next: OnboardingState | null) => void
] {
  const [state, setState] = usePersistedStoreCategory('onboarding');
  const stableState: [OnboardingState | null, (next: OnboardingState | null) => void] =
    useMemo(() => {
      const onboardingState = state
        ? {
            ...state,
            platformToProjectIdMap: state.platformToProjectIdMap || {},
            selectedPlatforms: state.selectedPlatforms || [],
            selectedIntegrations: state.selectedIntegrations || [],
          }
        : null;
      return [onboardingState, setState];
    }, [state, setState]);
  return stableState;
}
