import {createContext, useEffect, useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {AppStoreConnectStatusData} from 'app/types/debugFiles';
import withApi from 'app/utils/withApi';
import withProject from 'app/utils/withProject';

const AppStoreConnectContext = createContext<AppStoreConnectStatusData | undefined>(
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
    const [appStoreConnectStatusData, setAppStoreConnectStatusData] = useState<
      AppStoreConnectStatusData | undefined
    >();

    useEffect(() => {
      fetchAppStoreConnectStatusData();
    }, [project]);

    function getAppStoreConnectSymbolSourceId() {
      return (project.symbolSources ? JSON.parse(project.symbolSources) : []).find(
        symbolSource => symbolSource.type.toLowerCase() === 'appstoreconnect'
      )?.id;
    }

    async function fetchAppStoreConnectStatusData() {
      const appStoreConnectSymbolSourceId = getAppStoreConnectSymbolSourceId();

      if (!appStoreConnectSymbolSourceId) {
        return;
      }

      try {
        const response: Map<string, AppStoreConnectStatusData> = await api.requestPromise(
          `/projects/${orgSlug}/${project.slug}/appstoreconnect/status`
        );

        const sourceStatus: AppStoreConnectStatusData | undefined =
          response[appStoreConnectSymbolSourceId];
        if (sourceStatus) {
          setAppStoreConnectStatusData(sourceStatus);
        }
      } catch {
        // do nothing
      }
    }

    return (
      <AppStoreConnectContext.Provider value={appStoreConnectStatusData}>
        {children}
      </AppStoreConnectContext.Provider>
    );
  })
);

const Consumer = AppStoreConnectContext.Consumer;

export {Provider, Consumer};

export default AppStoreConnectContext;
