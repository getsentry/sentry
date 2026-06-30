import {useCallback} from 'react';
import type {AsyncBatcher} from '@tanstack/react-pacer';
import type {QueryClient, UseQueryResult} from '@tanstack/react-query';
import {useQueries, useQueryClient} from '@tanstack/react-query';

import type {BatchingRequest} from 'sentry/utils/api/batching/createBatcher';

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

  const {fetchedData, isError, isPending} = useQueries({
    queries: ids.map(id => ({
      enabled,
      queryFn: batchedQueryFn(batcher, context, id),
      queryKey: [keyPrefix, context, id],
      staleTime: Infinity,
    })),
    combine,
  });

  const refetch = useCallback(() => {
    queryClient.refetchQueries({queryKey: [keyPrefix], type: 'active'});
  }, [keyPrefix, queryClient]);

  return {fetchedData, isError, isPending, refetch};
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

function combine<Data>(results: Array<UseQueryResult<Data | null>>) {
  const fetchedData: Data[] = [];
  let isPending = false;
  let isError = false;

  for (const result of results) {
    if (result.isLoading) {
      isPending = true;
    } else if (result.isError) {
      isError = true;
    } else if (result.data) {
      fetchedData.push(result.data);
    }
  }

  return {fetchedData, isPending, isError};
}
