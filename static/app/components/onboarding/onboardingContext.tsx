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
  removeProject: (id: string) => void;
  setProject: (props: Project & {id: string}) => void;
  setSelectedSDK: (props: Data['selectedSDK']) => void;
};

export const OnboardingContext = createContext<OnboardingContextProps>({
  setProject: () => {},
  setSelectedSDK: () => {},
  removeProject: () => {},
  data: {
    projects: {},
    selectedSDK: undefined,
  },
});

type ProviderProps = {
  children: React.ReactNode;
};

export function OnboardingContextProvider({children}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<Data>('onboarding', {
    projects: {},
    selectedSDK: undefined,
  });

  const setSelectedSDK = useCallback(
    (selectedSDK: Data['selectedSDK']) => {
      setSessionStorage({
        ...sessionStorage,
        selectedSDK,
      });
    },
    [setSessionStorage, sessionStorage]
  );

  const setProject = useCallback(
    (props: Project & {id: string}) => {
      setSessionStorage({
        ...sessionStorage,
        projects: {
          ...sessionStorage.projects,
          [props.id]: {
            status: props.status,
            firstIssueId: props.firstIssueId,
            slug: props.slug,
          },
        },
      });
    },
    [setSessionStorage, sessionStorage]
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
        setProject,
        removeProject,
        setSelectedSDK,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
