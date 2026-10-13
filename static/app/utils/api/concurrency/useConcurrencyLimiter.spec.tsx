import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useConcurrencyLimiter} from 'sentry/utils/api/concurrency/useConcurrencyLimiter';

function renderLimiter(concurrency: number) {
  return renderHook(useConcurrencyLimiter, {
    initialProps: {concurrency, key: 'test'},
  });
}

describe('useConcurrencyLimiter', () => {
  it('runs at most `concurrency` requests at a time and resolves all of them', async () => {
    const {result} = renderLimiter(3);
    const limit = result.current;
    const started: Array<PromiseWithResolvers<void>> = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const results = Array.from({length: 10}, (_, i) =>
      limit(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const deferred = Promise.withResolvers<void>();
        started.push(deferred);
        await deferred.promise;
        inFlight--;
        return i;
      })
    );

    await waitFor(() => expect(started).toHaveLength(3));

    // Finish requests one by one; each completion lets the next one start.
    for (let i = 0; i < 10; i++) {
      await waitFor(() => expect(started[i]).toBeDefined());
      started[i]!.resolve();
    }

    await expect(Promise.all(results)).resolves.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(maxInFlight).toBe(3);
  });

  it('returns the same limiter across renders', () => {
    const {result, rerender} = renderLimiter(3);
    const first = result.current;
    rerender({concurrency: 3, key: 'test'});
    expect(result.current).toBe(first);
  });

  it('rejects with the request error without blocking the queue', async () => {
    const {result} = renderLimiter(1);
    const error = new Error('429');

    const failed = result.current(() => Promise.reject(error));
    const succeeded = result.current(() => Promise.resolve('ok'));

    await expect(failed).rejects.toBe(error);
    await expect(succeeded).resolves.toBe('ok');
  });

  it('skips requests whose signal aborted while they were waiting', async () => {
    const {result} = renderLimiter(1);
    const blocker = Promise.withResolvers<void>();
    const controller = new AbortController();
    const skippedRequest = jest.fn(() => Promise.resolve('never'));

    const first = result.current(() => blocker.promise);
    const skipped = result.current(skippedRequest, controller.signal);
    controller.abort();
    blocker.resolve();

    await first;
    await expect(skipped).rejects.toBe(controller.signal.reason);
    expect(skippedRequest).not.toHaveBeenCalled();
  });

  it('keeps running queued requests after unmount', async () => {
    const {result, unmount} = renderLimiter(1);
    const blocker = Promise.withResolvers<void>();

    const first = result.current(() => blocker.promise);
    const queued = result.current(() => Promise.resolve('ok'));
    unmount();
    blocker.resolve();

    await first;
    await expect(queued).resolves.toBe('ok');
  });
});
