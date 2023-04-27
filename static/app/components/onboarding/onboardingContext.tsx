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
};

export function OnboardingContextProvider({children}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<Data>('onboarding', {
    projects: {},
    selectedSDK: undefined,
  });

  const setData = useCallback(
    (data: Data) => {
      setSessionStorage(data);
    },
    [setSessionStorage]
  );

  const removeProject = useCallback(
    (id: string) => {
      const newProjects = Object.keys(sessionStorage.projects).reduce((acc, key) => {
        if (key !== id) {
          acc[key] = sessionStorage.projects[key];
        }
        return acc;
      }, {});

      setSessionStorage({
        ...sessionStorage,
        projects: newProjects,
      });
    },
    [setSessionStorage, sessionStorage]
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
