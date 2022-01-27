import {createContext, useEffect, useState} from 'react';

import {Organization, Project} from 'sentry/types';
import {
  AppStoreConnectCredentialsStatus,
  AppStoreConnectStatusData,
} from 'sentry/types/debugFiles';
import {getAppStoreValidationErrorMessage} from 'sentry/utils/appStoreValidationErrorMessage';
import useApi from 'sentry/utils/useApi';

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

  const appStoreConnectSymbolSources = (
    projectDetails?.symbolSources ? JSON.parse(projectDetails.symbolSources) : []
  ).reduce((acc, {type, id, ...symbolSource}) => {
    if (type.toLowerCase() === 'appstoreconnect') {
      acc[id] = {type, ...symbolSource};
    }
    return acc;
  }, {});

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

  async function fetchAppStoreConnectStatusData() {
    if (!projectDetails) {
      return;
    }

    if (!Object.keys(appStoreConnectSymbolSources).length) {
      return;
    }

    try {
      const response: Record<string, AppStoreConnectStatusData> =
        await api.requestPromise(
          `/projects/${orgSlug}/${projectDetails.slug}/appstoreconnect/status/`
        );

      setAppStoreConnectStatusData(response);
    } catch {
      // do nothing
    }
  }

  function getUpdateAlertMessage(
    respository: NonNullable<Parameters<typeof getAppStoreValidationErrorMessage>[1]>,
    credentials: AppStoreConnectCredentialsStatus
  ) {
    if (credentials?.status === 'valid') {
      return undefined;
    }

    return getAppStoreValidationErrorMessage(credentials, respository);
  }

  return (
    <AppStoreConnectContext.Provider
      value={
        appStoreConnectStatusData && project
          ? Object.keys(appStoreConnectStatusData).reduce((acc, key) => {
              const appStoreConnect = appStoreConnectStatusData[key];
              return {
                ...acc,
                [key]: {
                  ...appStoreConnect,
                  updateAlertMessage: getUpdateAlertMessage(
                    {
                      name: appStoreConnectSymbolSources[key].name,
                      link: `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/?customRepository=${key}`,
                    },
                    appStoreConnect.credentials
                  ),
                },
              };
            }, {})
          : undefined
      }
    >
      {children}
    </AppStoreConnectContext.Provider>
  );
};

export {Provider};

export default AppStoreConnectContext;
