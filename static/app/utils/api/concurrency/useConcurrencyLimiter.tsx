import {useCallback} from 'react';
import {asyncQueuerOptions, useAsyncQueuer} from '@tanstack/react-pacer';

interface LimitedRequest {
  reject: (reason: unknown) => void;
  run: () => Promise<void>;
  signal: AbortSignal | undefined;
}

async function runLimitedRequest({reject, run, signal}: LimitedRequest) {
  // TanStack aborts the signal when nothing observes the query anymore, e.g.
  // the user navigated away. `apiFetch` doesn't forward the signal, so skip
  // the request here instead of sending it and spending rate-limit budget.
  if (signal?.aborted) {
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
 * Caps how many requests run at once. Call it in the hook that builds a group
 * of queries which share an API rate limit, and use the returned function
 * inside each `queryFn`:
 *
 * ```ts
 * const limit = useConcurrencyLimiter({concurrency, key});
 * queryFn: context => limit(() => apiFetch(context), context.signal)
 * ```
 *
 * Each call resolves or rejects with its own request's result, so TanStack
 * Query caching and retries are unchanged. A retry joins the back of the queue.
 */
export function useConcurrencyLimiter({
  concurrency,
  key,
}: {
  concurrency: number;
  key: string;
}) {
  const {addItem} = useAsyncQueuer(runLimitedRequest, {
    ...asyncQueuerOptions<LimitedRequest>({
      concurrency,
      key,
      started: true,
      // TanStack Query already retries failed queries, so Pacer must not retry
      // them too.
      asyncRetryerOptions: {maxAttempts: 1},
    }),
    // By default the queue stops when the component unmounts, which would
    // leave queued requests unsettled. Another component can still be
    // observing the same queries, so keep draining. Queries nobody observes
    // anymore are skipped by the aborted-signal check.
    onUnmount: keepDraining,
  });

  return useCallback(
    function limit<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      const deferred = Promise.withResolvers<T>();
      addItem({
        reject: deferred.reject,
        run: async () => deferred.resolve(await run()),
        signal,
      });
      return deferred.promise;
    },
    [addItem]
  );
}
