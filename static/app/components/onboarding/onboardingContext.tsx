import {createContext, useContext, useMemo} from 'react';

import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

export type OnboardingContextProps = {
  setSelectedPlatform: (selectedSDK?: OnboardingSelectedSDK) => void;
  selectedPlatform?: OnboardingSelectedSDK;
};

/**
 * Prefer using `useOnboardingContext` hook instead of directly using this context.
 */
export const OnboardingContext = createContext<OnboardingContextProps>({
  selectedPlatform: undefined,
  setSelectedPlatform: () => {},
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
    NonNullable<Pick<OnboardingContextProps, 'selectedPlatform'>> | undefined
  >(
    'onboarding',
    value?.selectedPlatform ? {selectedPlatform: value.selectedPlatform} : undefined
  );

  const contextValue = useMemo(
    () => ({
      selectedPlatform: onboarding?.selectedPlatform,
      setSelectedPlatform: (selectedPlatform?: OnboardingSelectedSDK) => {
        // If platform is undefined, remove the item from session storage
        if (selectedPlatform === undefined) {
          removeOnboarding();
        } else {
          setOnboarding({selectedPlatform});
        }
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
