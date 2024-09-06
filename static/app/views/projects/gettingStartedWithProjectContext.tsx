import {createContext, useCallback} from 'react';

import type {IssueAlertRule} from 'sentry/types/alerts';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type GettingStartedWithProject = Pick<Project, 'name' | 'id'> & {
  alertRules: IssueAlertRule[];
  platform: OnboardingSelectedSDK;
  teamSlug?: Project['team']['slug'];
};

export type ProjectsContextProps = {
  setProject: (project: GettingStartedWithProject) => void;
  project?: GettingStartedWithProject;
};

export const GettingStartedWithProjectContext = createContext<ProjectsContextProps>({
  project: undefined,
  setProject: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
  project?: GettingStartedWithProject;
};

export function GettingStartedWithProjectContextProvider({
  children,
  project,
}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<{
    project?: GettingStartedWithProject;
  }>('getting-started-with-project', {
    project,
  });

  const handleSetProject = useCallback(
    (newProject?: GettingStartedWithProject) => {
      setSessionStorage({project: newProject});
    },
    [setSessionStorage]
  );

  return (
    <GettingStartedWithProjectContext.Provider
      value={{
        project: sessionStorage.project,
        setProject: handleSetProject,
      }}
    >
      {children}
    </GettingStartedWithProjectContext.Provider>
  );
}
