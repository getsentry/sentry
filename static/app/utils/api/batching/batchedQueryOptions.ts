import type {AsyncBatcher} from '@tanstack/react-pacer';
import type {QueryClient} from '@tanstack/react-query';

import type {BatchingRequest} from 'sentry/utils/api/batching/createBatcher';

interface BatchedQueryOptions<Data, QueryContext> {
  batcher: AsyncBatcher<BatchingRequest<Data, QueryContext>>;
  context: QueryContext;
  ids: string[];
  keyPrefix: string;
}

/**
 * Builds one query options object per id that resolves through a shared
 * `createBatcher` batcher. Consumers pass the result to `useQueries` (adding
 * their own `enabled`, `staleTime`, `combine`, etc.) so each id keeps its own
 * cache entry while the network requests are coalesced.
 */
export function batchedQueryOptions<Data, QueryContext>({
  batcher,
  context,
  ids,
  keyPrefix,
}: BatchedQueryOptions<Data, QueryContext>) {
  return ids.map(id => ({
    queryKey: [keyPrefix, context, id],
    queryFn: batchedQueryFn(batcher, context, id),
  }));
}

function batchedQueryFn<Data, QueryContext>(
  batcher: AsyncBatcher<BatchingRequest<Data, QueryContext>>,
  context: QueryContext,
  id: string
) {
  return ({client}: {client: QueryClient}) => {
    const deferred = Promise.withResolvers<Data | null>();
    batcher.addItem({client, context, deferred, id});
    return deferred.promise;
  };
}
