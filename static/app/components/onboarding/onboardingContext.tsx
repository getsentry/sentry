import {createContext, useCallback} from 'react';

import {OnboardingStatus} from 'sentry/types';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Data = Record<
  string,
  {
    slug: string;
    status: OnboardingStatus;
    firstIssueId?: string;
  }
>;

export type OnboardingContextProps = {
  data: Data;
  setProjectData: (props: {
    projectId: string;
    projectSlug: string;
    status: OnboardingStatus;
    firstIssueId?: string;
  }) => void;
};

export const OnboardingContext = createContext<OnboardingContextProps>({
  setProjectData: () => {},
  data: {},
});

type ProviderProps = {
  children: React.ReactNode;
};

export function OnboardingContextProvider({children}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<Data>('onboarding', {});

  const setProjectData = useCallback(
    ({
      projectId,
      projectSlug,
      status,
      firstIssueId,
    }: {
      projectId: string;
      projectSlug: string;
      status: OnboardingStatus;
      firstIssueId?: string;
    }) => {
      setSessionStorage({
        ...sessionStorage,
        [projectId]: {
          status,
          firstIssueId,
          slug: projectSlug,
        },
      });
    },
    [setSessionStorage, sessionStorage]
  );

  return (
    <OnboardingContext.Provider value={{data: sessionStorage, setProjectData}}>
      {children}
    </OnboardingContext.Provider>
  );
}
