import {createContext, useMemo} from 'react';

import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

export type OnboardingContextProps = {
  setSelectedSDK: (selectedSDK?: OnboardingSelectedSDK) => void;
  selectedSDK?: OnboardingSelectedSDK;
};

/**
 * Prefer using `useOnboardingSDK` hook instead of directly using this context.
 */
export const OnboardingContext = createContext<OnboardingContextProps>({
  selectedSDK: undefined,
  setSelectedSDK: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
  /**
   * This is only used in our frontend tests to set the initial value of the context.
   */
  value?: Pick<OnboardingContextProps, 'selectedSDK'>;
};

export function OnboardingContextProvider({children, value}: ProviderProps) {
  const [onboarding, setOnboarding, removeOnboarding] = useSessionStorage<
    NonNullable<Pick<OnboardingContextProps, 'selectedSDK'>> | undefined
  >('onboarding', value?.selectedSDK ? {selectedSDK: value.selectedSDK} : undefined);

  const contextValue = useMemo(
    () => ({
      selectedSDK: onboarding?.selectedSDK,
      setSelectedSDK: (selectedSDK?: OnboardingSelectedSDK) => {
        // If SDK is undefined, remove the item from session storage
        if (selectedSDK === undefined) {
          removeOnboarding();
        } else {
          setOnboarding({selectedSDK});
        }
      },
    }),
    [onboarding, setOnboarding, removeOnboarding]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}
