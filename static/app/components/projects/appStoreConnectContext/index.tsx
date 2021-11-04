import {createContext, useEffect, useState} from 'react';

import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import useApi from 'app/utils/useApi';

export type AppStoreConnectContextProps = AppStoreConnectValidationData | undefined;

const AppStoreConnectContext = createContext<AppStoreConnectContextProps>(undefined);

import {getAppConnectStoreUpdateAlertMessage} from './utils';

type ProviderProps = {
  children: React.ReactNode;
  organization: Organization;
  project?: Project;
};

const Provider = ({children, project, organization}: ProviderProps) => {
  const api = useApi();

  const [projectDetails, setProjectDetails] = useState<undefined | Project>();
  const [appStoreConnectValidationData, setAppStoreConnectValidationData] =
    useState<AppStoreConnectContextProps>(undefined);

  const orgSlug = organization.slug;

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
      const response: AppStoreConnectValidationData[] = await api.requestPromise(
        `/projects/${orgSlug}/${projectDetails.slug}/appstoreconnect/status`
      );

      const sourceStatus = response.find(
        s => s.id === appStoreConnectSymbolSourceId,
        response
      );

      if (sourceStatus) {
        setAppStoreConnectValidationData(sourceStatus);
      }
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
};

const Consumer = AppStoreConnectContext.Consumer;

export {Provider, Consumer};

export default AppStoreConnectContext;
