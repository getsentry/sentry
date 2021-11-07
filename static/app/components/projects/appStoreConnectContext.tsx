import {createContext, useEffect, useState} from 'react';

import {Organization, Project} from 'app/types';
import {
  AppStoreConnectCredentialsStatus,
  AppStoreConnectStatusData,
} from 'app/types/debugFiles';
import {getAppStoreValidationErrorMessage} from 'app/utils/appStoreValidationErrorMessage';
import useApi from 'app/utils/useApi';

export type AppStoreConnectContextProps =
  | Record<string, AppStoreConnectStatusData>
  | undefined;

const AppStoreConnectContext = createContext<AppStoreConnectContextProps>(undefined);

type ProviderProps = {
  children: React.ReactNode;
  organization: Organization;
  project?: Project;
};

const Provider = ({children, project, organization}: ProviderProps) => {
  const api = useApi();

  const [projectDetails, setProjectDetails] = useState<undefined | Project>();
  const [appStoreConnectStatusData, setAppStoreConnectStatusData] =
    useState<AppStoreConnectContextProps>(undefined);

  const orgSlug = organization.slug;

  useEffect(() => {
    fetchProjectDetails();
  }, [project]);

  useEffect(() => {
    fetchAppStoreConnectStatusData();
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

  async function fetchAppStoreConnectStatusData() {
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
      const response: Record<string, AppStoreConnectStatusData> =
        await api.requestPromise(
          `/projects/${orgSlug}/${projectDetails.slug}/appstoreconnect/status`
        );

      setAppStoreConnectStatusData(response);
    } catch {
      // do nothing
    }
  }

  function getUpdateAlertMessage(credentialsStatus: AppStoreConnectCredentialsStatus) {
    if (credentialsStatus?.status === 'valid') {
      return undefined;
    }
    return getAppStoreValidationErrorMessage(credentialsStatus);
  }

  return (
    <AppStoreConnectContext.Provider
      value={
        appStoreConnectStatusData
          ? Object.keys(appStoreConnectStatusData).reduce(
              (acc, key) => ({
                ...acc,
                [key]: {
                  ...appStoreConnectStatusData[key],
                  updateAlertMessage: getUpdateAlertMessage(
                    appStoreConnectStatusData[key].credentials
                  ),
                },
              }),
              {}
            )
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
