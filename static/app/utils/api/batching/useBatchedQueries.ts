import {useCallback} from 'react';
import type {AsyncBatcher} from '@tanstack/react-pacer';
import type {QueryClient, UseQueryResult} from '@tanstack/react-query';
import {useQueries, useQueryClient} from '@tanstack/react-query';

import type {BatchingRequest} from 'sentry/utils/api/batching/createBatcher';

type BatchedQueryStatus = 'error' | 'pending' | 'success';

interface BatchedQueriesOptions<Data, QueryContext> {
  batcher: AsyncBatcher<BatchingRequest<Data, QueryContext>>;
  context: QueryContext;
  enabled: boolean;
  ids: string[];
  keyPrefix: string;
}

export function useBatchedQueries<Data, QueryContext>({
  batcher,
  context,
  enabled,
  ids,
  keyPrefix,
}: BatchedQueriesOptions<Data, QueryContext>) {
  const queryClient = useQueryClient();

  const {fetchedData, isError, isPending, statusById} = useQueries({
    queries: ids.map(id => ({
      enabled,
      queryFn: batchedQueryFn(batcher, context, id),
      queryKey: [keyPrefix, context, id],
      staleTime: Infinity,
    })),
    combine: results => combine(results, ids),
  });

  const refetch = useCallback(() => {
    queryClient.refetchQueries({queryKey: [keyPrefix], type: 'active'});
  }, [keyPrefix, queryClient]);

  return {fetchedData, isError, isPending, statusById, refetch};
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

function combine<Data>(results: Array<UseQueryResult<Data | null>>, ids: string[]) {
  const fetchedData: Data[] = [];
  const statusById = new Map<string, BatchedQueryStatus>();
  let isPending = false;
  let isError = false;

  results.forEach((result, index) => {
    const id = ids[index];
    if (result.isLoading) {
      isPending = true;
      if (id !== undefined) {
        statusById.set(id, 'pending');
      }
    } else if (result.isError) {
      isError = true;
      if (id !== undefined) {
        statusById.set(id, 'error');
      }
    } else {
      if (id !== undefined) {
        statusById.set(id, 'success');
      }
      if (result.data) {
        fetchedData.push(result.data);
      }
    }
  });

  return {fetchedData, isPending, isError, statusById};
}
