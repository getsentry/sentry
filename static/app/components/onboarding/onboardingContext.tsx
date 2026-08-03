import {createContext, useContext, useEffect, useMemo, useRef} from 'react';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type OnboardingContextProps = {
  clearDerivedState: () => void;
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

type OnboardingSessionState = {
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
  clearDerivedState: () => {},
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
  const [onboarding, setOnboarding, removeOnboarding] = useSessionStorage(
    'onboarding',
    initialValue
  );

  // An optimistic repo (empty id, see useScmRepoSelection) persisted by a
  // refresh mid-resolution can never fetch detection and would hold the
  // platform step in a permanent spinner. Drop it once on load, also clearing
  // the repo-derived state so the platform step doesn't show a platform with no
  // connected repo (mirrors clearDerivedState on a repo change). Live in-session
  // optimistic selections arrive after mount and keep their loading state.
  const hadStaleRepoOnLoad = useRef(
    !!onboarding?.selectedRepository && !onboarding.selectedRepository.id
  );
  useEffect(() => {
    if (hadStaleRepoOnLoad.current) {
      hadStaleRepoOnLoad.current = false;
      setOnboarding(prev => ({
        ...prev,
        selectedRepository: undefined,
        selectedPlatform: undefined,
        selectedFeatures: undefined,
        createdProjectSlug: undefined,
      }));
    }
  }, [setOnboarding]);

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
      // Clear state derived from the selected repository (platform, features,
      // created project) without wiping the entire session. Use this when the
      // repo changes so downstream steps start fresh.
      clearDerivedState: () => {
        setOnboarding(prev => ({
          ...prev,
          selectedPlatform: undefined,
          selectedFeatures: undefined,
          createdProjectSlug: undefined,
        }));
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
