import {createContext, useCallback} from 'react';

import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

type GettingStartedWithProject = Pick<Project, 'name' | 'id'> & {
  alertRule: Partial<RequestDataFragment> | undefined;
  platform: OnboardingSelectedSDK;
  teamSlug?: Project['team']['slug'];
};

type ProjectsContextProps = {
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
    <GettingStartedWithProjectContext
      value={{
        project: sessionStorage.project,
        setProject: handleSetProject,
      }}
    >
      {children}
    </GettingStartedWithProjectContext>
  );
}
