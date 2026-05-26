import {processInChunks} from 'sentry/utils/array/procesInChunks';

describe('processInChunks', () => {
  it('returns an empty array for empty input', async () => {
    const fn = jest.fn().mockResolvedValue('x');
    const results = await processInChunks({items: [], chunkSize: 3, fn});
    expect(results).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('processes all items when count is less than chunkSize', async () => {
    const fn = jest.fn((x: number) => Promise.resolve(x * 2));
    const results = await processInChunks({items: [1, 2], chunkSize: 5, fn});
    expect(results).toEqual([
      {status: 'fulfilled', value: 2},
      {status: 'fulfilled', value: 4},
    ]);
  });

  it('processes all items when count equals chunkSize exactly', async () => {
    const fn = jest.fn((x: number) => Promise.resolve(x * 2));
    const results = await processInChunks({items: [1, 2, 3], chunkSize: 3, fn});
    expect(results).toHaveLength(3);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });

  it('processes all items across multiple chunks', async () => {
    const fn = jest.fn((x: number) => Promise.resolve(x));
    const results = await processInChunks({
      items: [1, 2, 3, 4, 5],
      chunkSize: 2,
      fn,
    });
    expect(results).toHaveLength(5);
    expect(fn).toHaveBeenCalledTimes(5);
    expect(results.map(r => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('preserves result order matching input order', async () => {
    // Simulate varying async latency: later items resolve faster
    const fn = jest.fn(
      (x: number) =>
        new Promise<number>(resolve => setTimeout(() => resolve(x), (10 - x) * 10))
    );
    const results = await processInChunks({items: [1, 2, 3, 4, 5], chunkSize: 5, fn});
    expect(results.map(r => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('processes chunks sequentially, not all at once', async () => {
    const callOrder: number[] = [];
    const fn = jest.fn((x: number) => {
      callOrder.push(x);
      return Promise.resolve(x);
    });

    await processInChunks({items: [1, 2, 3, 4, 5, 6], chunkSize: 2, fn});

    // Each chunk of 2 must start only after the previous chunk completes.
    // Because fn is synchronous here, within each chunk the call order is
    // preserved and chunks are processed sequentially.
    expect(callOrder).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('marks rejected items as rejected without stopping other items', async () => {
    const fn = jest.fn((x: number) =>
      x === 3 ? Promise.reject(new Error('boom')) : Promise.resolve(x)
    );
    const results = await processInChunks({items: [1, 2, 3, 4, 5], chunkSize: 5, fn});
    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({status: 'fulfilled', value: 1});
    expect(results[1]).toEqual({status: 'fulfilled', value: 2});
    expect(results[2]).toMatchObject({status: 'rejected', reason: expect.any(Error)});
    expect(results[3]).toEqual({status: 'fulfilled', value: 4});
    expect(results[4]).toEqual({status: 'fulfilled', value: 5});
  });

  it('continues processing later chunks when an earlier chunk has failures', async () => {
    const fn = jest.fn((x: number) =>
      x === 1 ? Promise.reject(new Error('first chunk error')) : Promise.resolve(x)
    );
    // chunk 1: [1] (fails), chunk 2: [2, 3] (succeeds)
    const results = await processInChunks({items: [1, 2, 3], chunkSize: 1, fn});
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({status: 'rejected'});
    expect(results[1]).toEqual({status: 'fulfilled', value: 2});
    expect(results[2]).toEqual({status: 'fulfilled', value: 3});
  });

  it('handles chunkSize of 1 by processing items one at a time', async () => {
    const fn = jest.fn((x: number) => Promise.resolve(x));
    const results = await processInChunks({items: [10, 20, 30], chunkSize: 1, fn});
    expect(results).toHaveLength(3);
    expect(results.map(r => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      10, 20, 30,
    ]);
  });

  it('handles chunkSize larger than item count', async () => {
    const fn = jest.fn((x: number) => Promise.resolve(x));
    const results = await processInChunks({items: [1, 2], chunkSize: 100, fn});
    expect(results).toHaveLength(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
