import {createContext, useCallback} from 'react';

import {OnboardingProjectStatus, OnboardingSelectedSDK} from 'sentry/types';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Project = {
  id: string;
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
  selectedSDK: (props: Pick<Data, 'selectedSDK'>) => void;
  setProject: (props: Project) => void;
};

export const OnboardingContext = createContext<OnboardingContextProps>({
  setProject: () => {},
  selectedSDK: () => {},
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

  const selectedSDK = useCallback(
    (props: Pick<Data, 'selectedSDK'>) => {
      setSessionStorage({
        ...sessionStorage,
        selectedSDK: props.selectedSDK,
      });
    },
    [setSessionStorage, sessionStorage]
  );

  const setProject = useCallback(
    ({id, slug, status, firstIssueId}: Project) => {
      setSessionStorage({
        ...sessionStorage,
        [id]: {
          status,
          firstIssueId,
          slug,
        },
      });
    },
    [setSessionStorage, sessionStorage]
  );

  return (
    <OnboardingContext.Provider
      value={{
        data: sessionStorage,
        setProject,
        selectedSDK,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
