import {createContext, useContext, useMemo} from 'react';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type OnboardingContextProps = {
  setCreatedProjectSlug: (slug?: string) => void;
  setSelectedFeatures: (features?: ProductSolution[]) => void;
  setSelectedIntegration: (integration?: Integration) => void;
  setSelectedPlatform: (selectedSDK?: OnboardingSelectedSDK) => void;
  setSelectedRepository: (repo?: Repository) => void;
  createdProjectSlug?: string;
  selectedFeatures?: ProductSolution[];
  selectedIntegration?: Integration;
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepository?: Repository;
};

export type OnboardingSessionState = {
  createdProjectSlug?: string;
  selectedFeatures?: ProductSolution[];
  selectedIntegration?: Integration;
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepository?: Repository;
};

/**
 * Prefer using `useOnboardingContext` hook instead of directly using this context.
 */
const OnboardingContext = createContext<OnboardingContextProps>({
  selectedPlatform: undefined,
  setSelectedPlatform: () => {},
  selectedIntegration: undefined,
  setSelectedIntegration: () => {},
  selectedRepository: undefined,
  setSelectedRepository: () => {},
  selectedFeatures: undefined,
  setSelectedFeatures: () => {},
  createdProjectSlug: undefined,
  setCreatedProjectSlug: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
  /**
   * Optional initial session state. Primarily used in tests to seed the context
   * without touching session storage directly.
   */
  initialValue?: OnboardingSessionState;
};

export function OnboardingContextProvider({children, initialValue}: ProviderProps) {
  const [onboarding, setOnboarding, removeOnboarding] = useSessionStorage<
    OnboardingSessionState | undefined
  >('onboarding', initialValue);

  const contextValue = useMemo(
    () => ({
      selectedPlatform: onboarding?.selectedPlatform,
      setSelectedPlatform: (selectedPlatform?: OnboardingSelectedSDK) => {
        if (selectedPlatform === undefined) {
          removeOnboarding();
        } else {
          setOnboarding(prev => ({...prev, selectedPlatform}));
        }
      },
      selectedIntegration: onboarding?.selectedIntegration,
      setSelectedIntegration: (selectedIntegration?: Integration) => {
        setOnboarding(prev => ({...prev, selectedIntegration}));
      },
      selectedRepository: onboarding?.selectedRepository,
      setSelectedRepository: (selectedRepository?: Repository) => {
        setOnboarding(prev => ({...prev, selectedRepository}));
      },
      selectedFeatures: onboarding?.selectedFeatures,
      setSelectedFeatures: (selectedFeatures?: ProductSolution[]) => {
        setOnboarding(prev => ({...prev, selectedFeatures}));
      },
      createdProjectSlug: onboarding?.createdProjectSlug,
      setCreatedProjectSlug: (createdProjectSlug?: string) => {
        setOnboarding(prev => ({...prev, createdProjectSlug}));
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
