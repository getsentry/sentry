import {createContext, useCallback} from 'react';

import {OnboardingProjectStatus, OnboardingSelectedSDK} from 'sentry/types';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Project = {
  slug: string;
  status: OnboardingProjectStatus;
  firstIssueId?: string;
};

type Data = {
  projects: Record<string, Project>;
  selectedSDK?: OnboardingSelectedSDK;
};

export type OnboardingContextProps = {
  data: Data;
  setData: (data: Data) => void;
};

export const OnboardingContext = createContext<OnboardingContextProps>({
  data: {
    projects: {},
    selectedSDK: undefined,
  },
  setData: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
  value?: Data;
};

export function OnboardingContextProvider({children, value}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<Data>('onboarding', {
    projects: value?.projects ?? {},
    selectedSDK: value?.selectedSDK,
  });

  const setData = useCallback(
    (data: Data) => {
      setSessionStorage(data);
    },
    [setSessionStorage]
  );

  return (
    <OnboardingContext.Provider
      value={{
        data: sessionStorage,
        setData,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
