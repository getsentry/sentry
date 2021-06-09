import {createContext, useEffect, useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import withApi from 'app/utils/withApi';

export type AppStoreConnectContextProps = AppStoreConnectValidationData & {
  isLoading?: boolean;
};

const appStoreConnectContextInitialData = {
  isLoading: undefined,
  id: undefined,
  appstoreCredentialsValid: undefined,
  itunesSessionValid: undefined,
  itunesSessionRefreshAt: undefined,
};

const AppStoreConnectContext = createContext<AppStoreConnectContextProps>(
  appStoreConnectContextInitialData
);

type ProviderProps = {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  api: Client;
  project?: Project;
};

const Provider = withApi(({api, children, project, orgSlug}: ProviderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projectDetails, setProjectDetails] = useState<undefined | Project>();
  const [
    appStoreConnectValidationData,
    setAppStoreConnectValidationData,
  ] = useState<AppStoreConnectContextProps>(appStoreConnectContextInitialData);

  useEffect(() => {
    fetchProjectDetails();
  }, [project]);

  useEffect(() => {
    fetchAppStoreConnectValidationData();
  }, [projectDetails]);

  async function fetchProjectDetails() {
    if (!project || projectDetails) {
      return;
    }

    if (project.symbolSources) {
      setProjectDetails(project);
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.requestPromise(`/projects/${orgSlug}/${project.slug}/`);
      setProjectDetails(response);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      // do nothing
    }
  }

  function getAppStoreConnectSymbolSourceId(symbolSources?: string) {
    return (symbolSources ? JSON.parse(symbolSources) : []).find(
      symbolSource => symbolSource.type === 'appStoreConnect'
    )?.id;
  }

  async function fetchAppStoreConnectValidationData() {
    if (!projectDetails) {
      return;
    }

    const appStoreConnectSymbolSourceId = getAppStoreConnectSymbolSourceId(
      projectDetails.symbolSources
    );

    if (!appStoreConnectSymbolSourceId) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectDetails.slug}/appstoreconnect/validate/${appStoreConnectSymbolSourceId}/`
      );
      setAppStoreConnectValidationData({
        id: appStoreConnectSymbolSourceId,
        ...response,
      });
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      // do nothing
    }
  }

  return (
    <AppStoreConnectContext.Provider
      value={{isLoading, ...appStoreConnectValidationData}}
    >
      {children}
    </AppStoreConnectContext.Provider>
  );
});

const Consumer = AppStoreConnectContext.Consumer;

export {Provider, Consumer};

export default AppStoreConnectContext;
