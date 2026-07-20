import {AsyncBatcher} from '@tanstack/react-pacer';
import type {QueryClient} from '@tanstack/react-query';

export interface BatchingRequest<Data, QueryContext> {
  client: QueryClient;
  context: QueryContext;
  deferred: PromiseWithResolvers<Data | null>;
  id: string;
}

type BatchingFetcher<Data, QueryContext> = (
  client: QueryClient,
  context: QueryContext,
  ids: string[]
) => Promise<Map<string, Data | Error>>;

export function createBatcher<Data, QueryContext>(
  fetcher: BatchingFetcher<Data, QueryContext>
) {
  return new AsyncBatcher<BatchingRequest<Data, QueryContext>>(
    requests => {
      const {client, context} = requests[0]!;
      const ids = [...new Set(requests.map(request => request.id))];
      return fetcher(client, context, ids);
    },
    {
      wait: 0,
      onSuccess: (resultsById: Map<string, Data | Error>, requests) => {
        for (const {deferred, id} of requests) {
          const result = resultsById.get(id);
          if (result instanceof Error) {
            deferred.reject(result);
          } else {
            deferred.resolve(result ?? null);
          }
        }
      },
      onError: (error, requests) => {
        for (const {deferred} of requests) {
          deferred.reject(error);
        }
      },
    }
  );
}
