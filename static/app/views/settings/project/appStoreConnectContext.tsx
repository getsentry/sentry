import {createContext, useEffect, useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import withApi from 'app/utils/withApi';

const AppStoreConnectContext = createContext<AppStoreConnectValidationData | undefined>(
  undefined
);

type ProviderProps = {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  api: Client;
  project?: Project;
};

const Provider = withApi(({api, children, project, orgSlug}: ProviderProps) => {
  const [projectDetails, setProjectDetails] = useState<undefined | Project>();
  const [appStoreConnectValidationData, setAppStoreConnectValidationData] = useState<
    AppStoreConnectValidationData | undefined
  >();

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

    try {
      const response = await api.requestPromise(`/projects/${orgSlug}/${project.slug}/`);
      setProjectDetails(response);
    } catch {
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

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectDetails.slug}/appstoreconnect/validate/${appStoreConnectSymbolSourceId}/`
      );
      setAppStoreConnectValidationData({
        id: appStoreConnectSymbolSourceId,
        ...response,
        itunesSessionValid: false,
      });
    } catch {
      // do nothing
    }
  }

  return (
    <AppStoreConnectContext.Provider value={appStoreConnectValidationData}>
      {children}
    </AppStoreConnectContext.Provider>
  );
});

const Consumer = AppStoreConnectContext.Consumer;

export {Provider, Consumer};

export default AppStoreConnectContext;
