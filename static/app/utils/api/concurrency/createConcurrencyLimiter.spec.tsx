import {waitFor} from 'sentry-test/reactTestingLibrary';

import {createConcurrencyLimiter} from 'sentry/utils/api/concurrency/createConcurrencyLimiter';

describe('createConcurrencyLimiter', () => {
  it('runs at most `concurrency` requests at a time and resolves all of them', async () => {
    const enqueue = createConcurrencyLimiter({concurrency: 3, key: 'test'});
    const started: Array<PromiseWithResolvers<void>> = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const results = Array.from({length: 10}, (_, i) =>
      enqueue(async () => {
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

  it('rejects with the request error without blocking the queue', async () => {
    const enqueue = createConcurrencyLimiter({concurrency: 1, key: 'test'});
    const error = new Error('429');

    const failed = enqueue(() => Promise.reject(error));
    const succeeded = enqueue(() => Promise.resolve('ok'));

    await expect(failed).rejects.toBe(error);
    await expect(succeeded).resolves.toBe('ok');
  });

  it('skips requests whose signal aborted while they were waiting', async () => {
    const enqueue = createConcurrencyLimiter({concurrency: 1, key: 'test'});
    const blocker = Promise.withResolvers<void>();
    const controller = new AbortController();
    const skippedRequest = jest.fn(() => Promise.resolve('never'));

    const first = enqueue(() => blocker.promise);
    const skipped = enqueue(skippedRequest, controller.signal);
    controller.abort();
    blocker.resolve();

    await first;
    await expect(skipped).rejects.toBe(controller.signal.reason);
    expect(skippedRequest).not.toHaveBeenCalled();
  });
});
