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
  cached?: boolean;
};

const Provider = withApi(
  withProject(({api, children, project, orgSlug, cached}: ProviderProps) => {
    const [appStoreConnectValidationData, setAppStoreConnectValidationData] = useState<
      AppStoreConnectValidationData | undefined
    >();

    useEffect(() => {
      fetchAppStoreConnectValidationData();
    }, [project]);

    function getAppStoreConnectSymbolSourceId() {
      return (project.symbolSources ? JSON.parse(project.symbolSources) : []).find(
        symbolSource => symbolSource.type === 'appStoreConnect'
      )?.id;
    }

    async function fetchAppStoreConnectValidationData() {
      const appStoreConnectSymbolSourceId = getAppStoreConnectSymbolSourceId();

      if (!appStoreConnectSymbolSourceId) {
        return;
      }

      try {
        let url = `/projects/${orgSlug}/${project.slug}/appstoreconnect/validate/${appStoreConnectSymbolSourceId}/`;
        if (cached) {
          url += '?cached';
        }
        const response: AppStoreConnectValidationData = await api.requestPromise(url);
        setAppStoreConnectValidationData(response);
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
