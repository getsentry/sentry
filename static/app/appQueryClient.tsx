import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';
import {persistQueryClient} from '@tanstack/react-query-persist-client';
import {del as removeItem, get as getItem, set as setItem} from 'idb-keyval';

import {DEFAULT_QUERY_CLIENT_CONFIG, QueryClient} from 'sentry/utils/queryClient';

/**
 * Named it appQueryClient because we already have a queryClient in sentry/utils/queryClient
 * @link https://tanstack.com/query/v5/docs/reference/QueryClient
 */
export const appQueryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

export const localStoragePersister = createAsyncStoragePersister({
  storage: {getItem, setItem, removeItem},
  throttleTime: 10_000,
});

persistQueryClient({
  queryClient: appQueryClient,
  persister: localStoragePersister,
  dehydrateOptions: {
    // Persist a subset of queries to local storage
    shouldDehydrateQuery({queryKey}) {
      return (
        Array.isArray(queryKey) &&
        queryKey.length > 0 &&
        queryKey.at(-1)?.persistToLocalStorage
      );
    },
  },
});
