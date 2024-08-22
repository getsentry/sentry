import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister';
import {QueryClient} from '@tanstack/react-query';
import {persistQueryClient} from '@tanstack/react-query-persist-client';

const DEFAULT_QUERY_CLIENT_CONFIG = {
  defaultOptions: {
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    queries: {
      refetchOnWindowFocus: false,
    },
  },
};

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
});

export const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
});
