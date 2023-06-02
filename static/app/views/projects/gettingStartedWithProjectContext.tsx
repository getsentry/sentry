import {createContext, useCallback} from 'react';

import {OnboardingSelectedSDK, Project} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
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
