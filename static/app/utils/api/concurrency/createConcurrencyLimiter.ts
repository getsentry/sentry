import {AsyncQueuer, asyncQueuerOptions} from '@tanstack/react-pacer';

interface LimitedRequest {
  reject: (reason: unknown) => void;
  run: () => Promise<void>;
  signal: AbortSignal | undefined;
}

/**
 * Caps how many requests run at once. Create one limiter per group of
 * requests that share an API rate limit, at module scope so every query in
 * the group shares it. Use it inside a `queryFn`:
 *
 * ```ts
 * queryFn: context => limiter(() => apiFetch(context), context.signal)
 * ```
 *
 * Each call resolves or rejects with its own request's result, so TanStack
 * Query caching and retries are unchanged. A retry joins the back of the queue.
 */
export function createConcurrencyLimiter({
  concurrency,
  key,
}: {
  concurrency: number;
  key: string;
}) {
  const queuer = new AsyncQueuer<LimitedRequest>(
    async ({reject, run, signal}) => {
      // TanStack aborts the signal when nothing observes the query anymore,
      // e.g. the user navigated away. Skip the request so it doesn't hold up
      // requests that are still wanted.
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      try {
        await run();
      } catch (error) {
        reject(error);
      }
    },
    asyncQueuerOptions<LimitedRequest>({
      concurrency,
      key,
      started: true,
      // TanStack Query already retries failed queries, so Pacer must not retry
      // them too.
      asyncRetryerOptions: {maxAttempts: 1},
    })
  );

  return function limit<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const deferred = Promise.withResolvers<T>();
    queuer.addItem({
      reject: deferred.reject,
      run: async () => deferred.resolve(await run()),
      signal,
    });
    return deferred.promise;
  };
}
