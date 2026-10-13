import {useCallback} from 'react';
import {asyncQueuerOptions, useAsyncQueuer} from '@tanstack/react-pacer';

interface LimitedRequest {
  reject: (reason: unknown) => void;
  run: () => Promise<void>;
  signal: AbortSignal;
}

async function runLimitedRequest({reject, run, signal}: LimitedRequest) {
  // TanStack aborts the signal when nothing observes the query anymore, e.g.
  // the user navigated away. `apiFetch` doesn't forward the signal, so skip
  // the request here instead of sending it and spending rate-limit budget.
  if (signal.aborted) {
    reject(signal.reason);
    return;
  }
  try {
    await run();
  } catch (error) {
    reject(error);
  }
}

function keepDraining() {}

/**
 * Wraps a `queryFn` so that at most `concurrency` calls to it run at once.
 * Use it for a group of queries that share an API rate limit:
 *
 * ```ts
 * const limitedApiFetch = useConcurrencyLimitedQueryFn(apiFetch, {concurrency, key});
 * useQueries({queries: cursors.map(cursor => ({...options, queryFn: limitedApiFetch}))});
 * ```
 *
 * Each call resolves or rejects with its own request's result, so TanStack
 * Query caching and retries are unchanged. A retry joins the back of the queue.
 */
export function useConcurrencyLimitedQueryFn<
  TContext extends {signal: AbortSignal},
  TResult,
>(
  queryFn: (context: TContext) => Promise<TResult>,
  {concurrency, key}: {concurrency: number; key: string}
): (context: TContext) => Promise<TResult> {
  const {addItem} = useAsyncQueuer(runLimitedRequest, {
    ...asyncQueuerOptions<LimitedRequest>({
      concurrency,
      key,
      started: true,
      // TanStack Query already retries failed queries, so Pacer must not retry
      // them too.
      asyncRetryerOptions: {maxAttempts: 1},
    }),
    // Pacer's hook stops its queue on unmount by default. That would leave
    // queued requests unsettled, and the TanStack query they belong to can
    // outlive this component: another component observing the same query key
    // keeps waiting on the fetch this queue started. Let the queue drain;
    // requests for queries nobody observes anymore are skipped above.
    onUnmount: keepDraining,
  });

  return useCallback(
    (context: TContext) => {
      const deferred = Promise.withResolvers<TResult>();
      addItem({
        reject: deferred.reject,
        run: async () => deferred.resolve(await queryFn(context)),
        signal: context.signal,
      });
      return deferred.promise;
    },
    [addItem, queryFn]
  );
}
