import {useEffect} from 'react';
import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister';
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';

import {ResponseMeta} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {QueryClient, QueryState} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  organization: Organization;
};

// const shouldCacheQuery = (query: Query) => {
//   const statsPeriod = query.queryKey?.[1]?.statsPeriod;
//   const data: any = query.state.data;
//   const statusCode = data[2]?.statusCode;
//   return statsPeriod === '7d' && statusCode === 200;
// };

// const p = queryPersis;
// queryCache.subscribe(({query, type}) => {
//   const key = query.queryKey;
//   const data = query.state.data;
//   console.log(key);
//   // console.log(key, statsPeriod);
// });
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 1000 * 60 * 60, // 1 hour
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  throttleTime: 5000,
  serialize: res => {
    const queries = res.clientState.queries;
    queries.forEach(query => {
      const state = query.state as QueryState & {pageLinks?: string};
      const data = state.data as [any, string, ResponseMeta];
      const pageLinks = data?.[2]?.getResponseHeader('Link') ?? undefined;
      state.pageLinks = pageLinks;
    });
    return JSON.stringify(res);
  },
  deserialize: res => {
    const result = JSON.parse(res);
    const queries = result.clientState.queries;
    queries.forEach(query => {
      const state: QueryState & {pageLinks?: string} = query.state;
      const data = state.data as [any, string, ResponseMeta];
      const pageLinks = state.pageLinks ?? null;
      data[2].getResponseHeader = (headerName: string) => {
        if (headerName === 'Link') {
          return pageLinks;
        }
        return null;
      };
    });
    return result;
  },
});

function StarfishContainer({organization, children}: Props) {
  const location = useLocation();
  const router = useRouter();
  const {slug} = organization;
  const projectId =
    slug === 'sentry' ? '1' : slug === 'cramer' ? '4504120414765056' : null;
  useEffect(() => {
    if (projectId && location.query.project !== projectId) {
      router.replace({
        pathname: location.pathname,
        query: {...location.query, project: projectId},
      });
    }
  }, [location.pathname, location.query, projectId, router]);

  return (
    <Feature
      hookName="feature-disabled:starfish-view"
      features={['starfish-view']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <PersistQueryClientProvider client={queryClient} persistOptions={{persister}}>
          {children}
        </PersistQueryClientProvider>
      </NoProjectMessage>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

export default withOrganization(StarfishContainer);
