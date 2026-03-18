import {createContext, useContext, useMemo} from 'react';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type OnboardingContextProps = {
  setSelectedFeatures: (features?: ProductSolution[]) => void;
  setSelectedIntegration: (integration?: Integration) => void;
  setSelectedPlatform: (selectedSDK?: OnboardingSelectedSDK) => void;
  setSelectedRepositories: (repos?: Repository[]) => void;
  selectedFeatures?: ProductSolution[];
  selectedIntegration?: Integration;
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepositories?: Repository[];
};

type OnboardingSessionState = {
  selectedFeatures?: ProductSolution[];
  selectedIntegration?: Integration;
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepositories?: Repository[];
};

/**
 * Prefer using `useOnboardingContext` hook instead of directly using this context.
 */
const OnboardingContext = createContext<OnboardingContextProps>({
  selectedPlatform: undefined,
  setSelectedPlatform: () => {},
  selectedIntegration: undefined,
  setSelectedIntegration: () => {},
  selectedRepositories: undefined,
  setSelectedRepositories: () => {},
  selectedFeatures: undefined,
  setSelectedFeatures: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
  /**
   * This is only used in our frontend tests to set the initial value of the context.
   */
  value?: Pick<OnboardingContextProps, 'selectedPlatform'>;
};

export function OnboardingContextProvider({children, value}: ProviderProps) {
  const [onboarding, setOnboarding, removeOnboarding] = useSessionStorage<
    OnboardingSessionState | undefined
  >(
    'onboarding',
    value?.selectedPlatform ? {selectedPlatform: value.selectedPlatform} : undefined
  );

  const contextValue = useMemo(
    () => ({
      selectedPlatform: onboarding?.selectedPlatform,
      setSelectedPlatform: (selectedPlatform?: OnboardingSelectedSDK) => {
        if (selectedPlatform === undefined) {
          // Clear platform but preserve other SCM state (integration, repos, features).
          // Full reset only happens if no other state remains.
          const nextState = {
            ...onboarding,
            selectedPlatform: undefined,
          };
          const hasOtherState =
            nextState.selectedIntegration ||
            nextState.selectedRepositories ||
            nextState.selectedFeatures;
          if (hasOtherState) {
            setOnboarding(nextState);
          } else {
            removeOnboarding();
          }
        } else {
          setOnboarding({...onboarding, selectedPlatform});
        }
      },
      selectedIntegration: onboarding?.selectedIntegration,
      setSelectedIntegration: (selectedIntegration?: Integration) => {
        setOnboarding({...onboarding, selectedIntegration});
      },
      selectedRepositories: onboarding?.selectedRepositories,
      setSelectedRepositories: (selectedRepositories?: Repository[]) => {
        setOnboarding({...onboarding, selectedRepositories});
      },
      selectedFeatures: onboarding?.selectedFeatures,
      setSelectedFeatures: (selectedFeatures?: ProductSolution[]) => {
        setOnboarding({...onboarding, selectedFeatures});
      },
    }),
    [onboarding, setOnboarding, removeOnboarding]
  );

  return <OnboardingContext value={contextValue}>{children}</OnboardingContext>;
}

/**
 * Custom hook to access and update the selected SDK in the onboarding process.
 */
export function useOnboardingContext() {
  return useContext(OnboardingContext);
}
