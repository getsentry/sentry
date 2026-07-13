import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';
import {notifyManager, QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';
import {del, get, set} from 'idb-keyval';

import {SENTRY_RELEASE_VERSION} from 'sentry/constants/sdk';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClient';

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

// In v5, React Query batches with macrotask (setTimeout 0)
// This can cause flickering when resetting form state before the cache is updated.
// Using queueMicrotask will ensure the cache is updated before any state updates are processed.
// This will also be the default in v6, so this is a forward compatible change.

// Skipped in test environments because it causes act() warnings in tests that
// don't await async query state updates.
if (process.env.NODE_ENV !== 'test') {
  notifyManager.setScheduler(queueMicrotask);
}

// Track whether IndexedDB has failed so we can disable persistence for the session.
// IndexedDB can throw DOMExceptions (e.g. ConstraintError, QuotaExceededError) in
// certain browsers or when storage is corrupted. When that happens, we clear any
// corrupted data and stop trying to persist for the rest of the session.
let idbFailed = false;

async function idbGetItem(key: string): Promise<string | null | undefined> {
  if (idbFailed) return null;
  try {
    return (await get<string>(key)) ?? null;
  } catch {
    idbFailed = true;
    return null;
  }
}

async function idbSetItem(key: string, value: string): Promise<void> {
  if (idbFailed) return;
  try {
    await set(key, value);
  } catch {
    // Clear potentially corrupted data and disable persistence for this session.
    idbFailed = true;
    try {
      await del(cacheKey);
    } catch {
      // ignore cleanup errors
    }
  }
}

async function idbRemoveItem(key: string): Promise<void> {
  if (idbFailed) return;
  try {
    await del(key);
  } catch {
    idbFailed = true;
  }
}

const indexedDbPersister = createAsyncStoragePersister({
  // We're using indexedDB as our storage provider because projects cache can be large
  storage: {getItem: idbGetItem, setItem: idbSetItem, removeItem: idbRemoveItem},
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
    await idbRemoveItem(cacheKey);
  }
}
