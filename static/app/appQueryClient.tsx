import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';
import {persistQueryClient} from '@tanstack/react-query-persist-client';
import {del as removeItem, get as getItem, set as setItem} from 'idb-keyval';

import {SENTRY_RELEASE_VERSION} from 'sentry/constants';
import {DEFAULT_QUERY_CLIENT_CONFIG, QueryClient} from 'sentry/utils/queryClient';

/**
 * Named it appQueryClient because we already have a queryClient in sentry/utils/queryClient
 * @link https://tanstack.com/query/v5/docs/reference/QueryClient
 */
export const appQueryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);
const cacheKey = 'sentry-react-query-cache';

const localStoragePersister = createAsyncStoragePersister({
  // We're using indexedDB as our storage provider because projects cache can be large
  storage: {getItem, setItem, removeItem},
  // Reduce the frequency of writes to indexedDB
  throttleTime: 15_000,
  // The cache is stored entirely on one key
  key: cacheKey,
});

const isProjectsCacheEnabled = (
  window.__initialData?.features as unknown as string[]
)?.includes('organizations:cache-projects-ui');

/**
 * Attach the persister to the query client
 * @link https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
 */
if (isProjectsCacheEnabled) {
  persistQueryClient({
    queryClient: appQueryClient,
    persister: localStoragePersister,
    /**
     * Clear cache on release version change
     * Locally this does nothing, if you need to clear cache locally you can clear indexdb
     */
    buster: SENTRY_RELEASE_VERSION ?? 'local',
    dehydrateOptions: {
      // Persist a subset of queries to local storage
      shouldDehydrateQuery(query) {
        // This could be extended later to persist other queries
        return (
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          // Only persist queryKey bootstrap-projects for now
          query.queryKey[0] === 'bootstrap-projects'
        );
      },
    },
  });
}

export function restoreQueryCache() {
  if (isProjectsCacheEnabled) {
    localStoragePersister.restoreClient();
  }
}

export async function clearQueryCache() {
  await localStoragePersister.removeClient();
  await removeItem(cacheKey);
}
