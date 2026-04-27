import {createContext, useContext, useMemo} from 'react';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import type {AlertRuleOptions} from 'sentry/views/projectInstall/issueAlertOptions';

/**
 * Persisted form state from the SCM project details step. Stored so the
 * form can be restored when the user navigates back from setup-docs.
 * Cleared by the platform features step when the platform changes, so
 * stale inputs don't carry across platform selections.
 */
interface ProjectDetailsFormState {
  alertRuleConfig?: AlertRuleOptions;
  projectName?: string;
  teamSlug?: string;
}

type OnboardingContextProps = {
  clearDerivedState: () => void;
  setCreatedProjectSlug: (slug?: string) => void;
  setProjectDetailsForm: (form?: ProjectDetailsFormState) => void;
  setSelectedFeatures: (features?: ProductSolution[]) => void;
  setSelectedIntegration: (integration?: Integration) => void;
  setSelectedPlatform: (selectedSDK?: OnboardingSelectedSDK) => void;
  setSelectedRepository: (repo?: Repository) => void;
  createdProjectSlug?: string;
  projectDetailsForm?: ProjectDetailsFormState;
  selectedFeatures?: ProductSolution[];
  selectedIntegration?: Integration;
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepository?: Repository;
};

export type OnboardingSessionState = {
  createdProjectSlug?: string;
  projectDetailsForm?: ProjectDetailsFormState;
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
  projectDetailsForm: undefined,
  setProjectDetailsForm: () => {},
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
      projectDetailsForm: onboarding?.projectDetailsForm,
      setProjectDetailsForm: (projectDetailsForm?: ProjectDetailsFormState) => {
        setOnboarding(prev => ({...prev, projectDetailsForm}));
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
          projectDetailsForm: undefined,
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
