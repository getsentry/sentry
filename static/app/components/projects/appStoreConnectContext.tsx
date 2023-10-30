import {createContext, useEffect, useMemo, useState} from 'react';

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

function Provider({children, project, organization}: ProviderProps) {
  const api = useApi();

  const [projectDetails, setProjectDetails] = useState<undefined | Project>();
  const [appStoreConnectStatusData, setAppStoreConnectStatusData] =
    useState<AppStoreConnectContextProps>(undefined);

  const appStoreConnectSymbolSources = useMemo(() => {
    return (
      projectDetails?.symbolSources ? JSON.parse(projectDetails.symbolSources) : []
    ).reduce((acc, {type, id, ...symbolSource}) => {
      if (type.toLowerCase() === 'appstoreconnect') {
        acc[id] = {type, ...symbolSource};
      }
      return acc;
    }, {});
  }, [projectDetails?.symbolSources]);

  useEffect(() => {
    if (!project || projectDetails) {
      return undefined;
    }

    if (project.symbolSources) {
      setProjectDetails(project);
      return undefined;
    }

    let unmounted = false;

    api
      .requestPromise(`/projects/${organization.slug}/${project.slug}/`)
      .then(responseProjectDetails => {
        if (unmounted) {
          return;
        }

        setProjectDetails(responseProjectDetails);
      })
      .catch(() => {
        // We do not care about the error
      });

    return () => {
      unmounted = true;
    };
  }, [project, organization, api]);

  useEffect(() => {
    if (!projectDetails) {
      return undefined;
    }

    if (!Object.keys(appStoreConnectSymbolSources).length) {
      return undefined;
    }

    let unmounted = false;

    api
      .requestPromise(
        `/projects/${organization.slug}/${projectDetails.slug}/appstoreconnect/status/`
      )
      .then(appStoreConnectStatus => {
        if (unmounted) {
          return;
        }
        setAppStoreConnectStatusData(appStoreConnectStatus);
      })
      .catch(() => {
        // We do not care about the error
      });

    return () => {
      unmounted = true;
    };
  }, [projectDetails, organization, appStoreConnectSymbolSources, api]);

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
}

export {Provider};

export default AppStoreConnectContext;
