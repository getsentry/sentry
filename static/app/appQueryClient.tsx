import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';
import {del as removeItem, get as getItem, set as setItem} from 'idb-keyval';

import {SENTRY_RELEASE_VERSION} from 'sentry/constants';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

/**
 * Named it appQueryClient because we already have a queryClient in sentry/utils/queryClient
 * sentry/utils/queryClient is a small wrapper around react-query's functionality for our API.
 *
 * appQueryClient below is the app's react-query cache and should not be imported directly.
 * Instead, use `const queryClient = useQueryClient()`.
 * @link https://tanstack.com/query/v5/docs/reference/QueryClient
 */
const appQueryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);
const cacheKey = 'sentry-react-query-cache';

const indexedDbPersister = createAsyncStoragePersister({
  // We're using indexedDB as our storage provider because projects cache can be large
  storage: {getItem, setItem, removeItem},
  // Reduce the frequency of writes to indexedDB
  throttleTime: 10_000,
  // The cache is stored entirely on one key
  key: cacheKey,
});

const hasIndexedDb = !!window.indexedDB;

/**
 * Enables the PersistQueryClientProvider when the flag is enabled
 */
export function AppQueryClientProvider({children}: {children: React.ReactNode}) {
  if (!hasIndexedDb) {
    return <QueryClientProvider client={appQueryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={appQueryClient}
      persistOptions={{
        persister: indexedDbPersister,
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
              // Query is not pending or failed
              query.state.status === 'success' &&
              !query.isStale() &&
              // Currently only bootstrap-projects is persisted
              query.queryKey[0] === 'bootstrap-projects'
            );
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export async function clearQueryCache() {
  if (hasIndexedDb) {
    // Mark queries as stale so they won't be re-cached
    appQueryClient.invalidateQueries({
      queryKey: ['bootstrap-projects'],
      refetchType: 'none',
    });
    await removeItem(cacheKey);
  }
}
