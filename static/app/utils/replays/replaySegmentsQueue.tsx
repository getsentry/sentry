import {AsyncQueuer} from '@tanstack/react-pacer';

/**
 * Long replays can have thousands of segments, which the details page loads
 * as one request per page of segments. Firing them all at once trips the API's
 * concurrent and per-second rate limits (25 concurrent / 40 per second), and
 * the CORS preflights for those requests get limited too. Keep this well under
 * the concurrent limit, because other requests on the page share that budget.
 */
export const MAX_CONCURRENT_SEGMENT_REQUESTS = 10;

interface SegmentRequest {
  reject: (reason: unknown) => void;
  run: () => Promise<void>;
  signal: AbortSignal | undefined;
}

export function createReplaySegmentsQueue(concurrency: number) {
  const queuer = new AsyncQueuer<SegmentRequest>(
    async ({reject, run, signal}) => {
      // TanStack aborts the signal when nothing observes the query anymore,
      // e.g. the user navigated to a different replay. Skip the request so it
      // doesn't hold up the requests that are still wanted.
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
    {concurrency, key: 'replay-segments-queue', started: true}
  );

  return function enqueue<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const deferred = Promise.withResolvers<T>();
    queuer.addItem({
      reject: deferred.reject,
      run: async () => deferred.resolve(await run()),
      signal,
    });
    return deferred.promise;
  };
}

export const enqueueReplaySegmentsRequest = createReplaySegmentsQueue(
  MAX_CONCURRENT_SEGMENT_REQUESTS
);
