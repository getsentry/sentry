import {createContext, useEffect, useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import withApi from 'app/utils/withApi';

export type AppStoreConnectContextProps = AppStoreConnectValidationData | undefined;

const AppStoreConnectContext = createContext<AppStoreConnectContextProps>(undefined);

import {getAppConnectStoreUpdateAlertMessage} from './utils';

type ProviderProps = {
  children: React.ReactNode;
  organization: Organization;
  api: Client;
  project?: Project;
};

const Provider = withApi(({api, children, project, organization}: ProviderProps) => {
  const [projectDetails, setProjectDetails] = useState<undefined | Project>();
  const [appStoreConnectValidationData, setAppStoreConnectValidationData] =
    useState<AppStoreConnectContextProps>(undefined);

  const orgSlug = organization.slug;
  const hasAppConnectStoreFeatureFlag =
    !!organization.features?.includes('app-store-connect');

  useEffect(() => {
    fetchProjectDetails();
  }, [project]);

  useEffect(() => {
    fetchAppStoreConnectValidationData();
  }, [projectDetails]);

  async function fetchProjectDetails() {
    if (!hasAppConnectStoreFeatureFlag || !project || projectDetails) {
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
      symbolSource => symbolSource.type.toLowerCase() === 'appstoreconnect'
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
      });
    } catch {
      // do nothing
    }
  }

  return (
    <AppStoreConnectContext.Provider
      value={
        appStoreConnectValidationData
          ? {
              ...appStoreConnectValidationData,
              updateAlertMessage: getAppConnectStoreUpdateAlertMessage(
                appStoreConnectValidationData
              ),
            }
          : undefined
      }
    >
      {children}
    </AppStoreConnectContext.Provider>
  );
});

const Consumer = AppStoreConnectContext.Consumer;

export {Provider, Consumer};

export default AppStoreConnectContext;
