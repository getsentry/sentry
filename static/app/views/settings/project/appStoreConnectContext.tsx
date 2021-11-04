import {createContext, useEffect, useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import withApi from 'app/utils/withApi';
import withProject from 'app/utils/withProject';

const AppStoreConnectContext = createContext<AppStoreConnectValidationData | undefined>(
  undefined
);

type ProviderProps = {
  children: React.ReactNode;
  project: Project;
  orgSlug: Organization['slug'];
  api: Client;
};

const Provider = withApi(
  withProject(({api, children, project, orgSlug}: ProviderProps) => {
    const [appStoreConnectValidationData, setAppStoreConnectValidationData] = useState<
      AppStoreConnectValidationData | undefined
    >();

    useEffect(() => {
      fetchAppStoreConnectValidationData();
    }, [project]);

    function getAppStoreConnectSymbolSourceId() {
      return (project.symbolSources ? JSON.parse(project.symbolSources) : []).find(
        symbolSource => symbolSource.type.toLowerCase() === 'appstoreconnect'
      )?.id;
    }

    async function fetchAppStoreConnectValidationData() {
      const appStoreConnectSymbolSourceId = getAppStoreConnectSymbolSourceId();

      if (!appStoreConnectSymbolSourceId) {
        return;
      }

      try {
        const response: AppStoreConnectValidationData[] = await api.requestPromise(
          `/projects/${orgSlug}/${project.slug}/appstoreconnect/status`
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
      <AppStoreConnectContext.Provider value={appStoreConnectValidationData}>
        {children}
      </AppStoreConnectContext.Provider>
    );
  })
);

const Consumer = AppStoreConnectContext.Consumer;

export {Provider, Consumer};

export default AppStoreConnectContext;
