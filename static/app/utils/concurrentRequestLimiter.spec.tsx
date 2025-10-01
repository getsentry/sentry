import {ConcurrentRequestLimiter} from './concurrentRequestLimiter';

// Mock the uniqueId utility
jest.mock('sentry/utils/guid', () => ({
  uniqueId: jest.fn(() => 'mock-id-' + Math.random().toString(36).substring(2, 15)),
}));

describe('ConcurrentRequestLimiter', () => {
  let limiter: ConcurrentRequestLimiter;

  beforeEach(() => {
    limiter = new ConcurrentRequestLimiter(2); // Use small limit for easier testing
  });

  describe('constructor', () => {
    it('should create limiter with default max concurrent requests', () => {
      const defaultLimiter = new ConcurrentRequestLimiter();
      expect(defaultLimiter.getStats().maxConcurrent).toBe(15);
    });

    it('should create limiter with custom max concurrent requests', () => {
      const customLimiter = new ConcurrentRequestLimiter(5);
      expect(customLimiter.getStats().maxConcurrent).toBe(5);
    });

    it('should throw error for invalid maxConcurrent values', () => {
      expect(() => new ConcurrentRequestLimiter(0)).toThrow(
        'maxConcurrent must be greater than 0'
      );
      expect(() => new ConcurrentRequestLimiter(-1)).toThrow(
        'maxConcurrent must be greater than 0'
      );
    });
  });

  describe('execute', () => {
    it('should execute request immediately when under limit', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await limiter.execute(mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(limiter.getActiveCount()).toBe(0); // Should be 0 after completion
      expect(limiter.getQueueLength()).toBe(0);
    });

    it('should queue requests when at limit', async () => {
      const slowRequest = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 100))
      );
      const fastRequest = jest.fn().mockResolvedValue('fast');

      // Start two requests to reach the limit
      const promise1 = limiter.execute(slowRequest);
      const promise2 = limiter.execute(slowRequest);

      // This should be queued
      const promise3 = limiter.execute(fastRequest);

      expect(limiter.getActiveCount()).toBe(2);
      expect(limiter.getQueueLength()).toBe(1);

      // Wait for all to complete
      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual(['slow', 'slow', 'fast']);
      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getQueueLength()).toBe(0);
    });

    it('should process queue in FIFO order', async () => {
      const executionOrder: string[] = [];

      const createRequest = (id: string, delay = 50) =>
        jest.fn(
          () =>
            new Promise(resolve => {
              setTimeout(() => {
                executionOrder.push(id);
                resolve(id);
              }, delay);
            })
        );

      const request1 = createRequest('first');
      const request2 = createRequest('second');
      const request3 = createRequest('third');
      const request4 = createRequest('fourth');

      // Start requests - first two should execute, others queued
      const promises = [
        limiter.execute(request1),
        limiter.execute(request2),
        limiter.execute(request3),
        limiter.execute(request4),
      ];

      expect(limiter.getActiveCount()).toBe(2);
      expect(limiter.getQueueLength()).toBe(2);

      await Promise.all(promises);

      // First two can start in any order, but third and fourth should be in queue order
      expect(executionOrder).toHaveLength(4);
      expect(executionOrder.slice(0, 2)).toEqual(
        expect.arrayContaining(['first', 'second'])
      );
      expect(executionOrder.slice(2)).toEqual(['third', 'fourth']);
    });

    it('should handle request errors correctly', async () => {
      const errorRequest = jest.fn().mockRejectedValue(new Error('Request failed'));
      const successRequest = jest.fn().mockResolvedValue('success');

      await expect(limiter.execute(errorRequest)).rejects.toThrow('Request failed');

      // Should still be able to execute more requests after error
      const result = await limiter.execute(successRequest);
      expect(result).toBe('success');

      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getQueueLength()).toBe(0);
    });

    it('should handle mixed success and error requests', async () => {
      const slowError = jest.fn(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Slow error')), 50)
          )
      );
      const fastSuccess = jest.fn().mockResolvedValue('fast success');
      const queuedSuccess = jest.fn().mockResolvedValue('queued success');

      // Start two requests to reach limit
      const errorPromise = limiter.execute(slowError);
      const successPromise = limiter.execute(fastSuccess);

      // This should be queued
      const queuedPromise = limiter.execute(queuedSuccess);

      expect(limiter.getActiveCount()).toBe(2);
      expect(limiter.getQueueLength()).toBe(1);

      // Wait for all to settle
      const results = await Promise.allSettled([
        errorPromise,
        successPromise,
        queuedPromise,
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');

      if (results[1].status === 'fulfilled') {
        expect(results[1].value).toBe('fast success');
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value).toBe('queued success');
      }

      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getQueueLength()).toBe(0);
    });

    it('should handle concurrent execution correctly', async () => {
      const concurrentRequests = Array.from({length: 10}, (_, i) =>
        jest.fn().mockResolvedValue(`result-${i}`)
      );

      const promises = concurrentRequests.map((fn, _) =>
        limiter.execute(() => fn().then((result: string) => `${result}-executed`))
      );

      // Should have 2 active and 8 queued
      expect(limiter.getActiveCount()).toBe(2);
      expect(limiter.getQueueLength()).toBe(8);

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBe(`result-${i}-executed`);
      });

      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getQueueLength()).toBe(0);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(limiter.getActiveCount()).toBe(0);
    });

    it('should track active requests correctly', async () => {
      const slowRequest = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('done'), 100))
      );

      const promise1 = limiter.execute(slowRequest);
      expect(limiter.getActiveCount()).toBe(1);

      const promise2 = limiter.execute(slowRequest);
      expect(limiter.getActiveCount()).toBe(2);

      await Promise.all([promise1, promise2]);
      expect(limiter.getActiveCount()).toBe(0);
    });
  });

  describe('getQueueLength', () => {
    it('should return 0 initially', () => {
      expect(limiter.getQueueLength()).toBe(0);
    });

    it('should track queued requests correctly', async () => {
      const slowRequest = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('done'), 100))
      );

      // Fill up active slots
      const promise1 = limiter.execute(slowRequest);
      const promise2 = limiter.execute(slowRequest);
      expect(limiter.getQueueLength()).toBe(0);

      // These should be queued
      const promise3 = limiter.execute(slowRequest);
      expect(limiter.getQueueLength()).toBe(1);

      const promise4 = limiter.execute(slowRequest);
      expect(limiter.getQueueLength()).toBe(2);

      await Promise.all([promise1, promise2, promise3, promise4]);
      expect(limiter.getQueueLength()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct initial stats', () => {
      const stats = limiter.getStats();

      expect(stats).toEqual({
        active: 0,
        queued: 0,
        maxConcurrent: 2,
      });
    });

    it('should return correct stats during execution', async () => {
      const slowRequest = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('done'), 100))
      );

      // Start requests
      const promise1 = limiter.execute(slowRequest);
      const promise2 = limiter.execute(slowRequest);
      const promise3 = limiter.execute(slowRequest);

      const stats = limiter.getStats();
      expect(stats).toEqual({
        active: 2,
        queued: 1,
        maxConcurrent: 2,
      });

      await Promise.all([promise1, promise2, promise3]);

      const finalStats = limiter.getStats();
      expect(finalStats).toEqual({
        active: 0,
        queued: 0,
        maxConcurrent: 2,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty queue processing', () => {
      // This tests the internal processNextInQueue method when queue is empty
      expect(() => {
        // Trigger internal queue processing (this is tested indirectly through normal execution)
        limiter.getStats();
      }).not.toThrow();
    });

    it('should handle rapid successive requests', async () => {
      const fastRequests = Array.from({length: 100}, (_, i) =>
        jest.fn().mockResolvedValue(i)
      );

      const promises = fastRequests.map(fn => limiter.execute(() => fn()));
      const results = await Promise.all(promises);

      expect(results).toEqual(Array.from({length: 100}, (_, i) => i));
      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getQueueLength()).toBe(0);
    });

    it('should handle requests that throw synchronously', async () => {
      const syncErrorRequest = jest.fn(() => {
        throw new Error('Sync error');
      });

      await expect(limiter.execute(syncErrorRequest)).rejects.toThrow('Sync error');

      // Should still work after sync error
      const successRequest = jest.fn().mockResolvedValue('success');
      const result = await limiter.execute(successRequest);
      expect(result).toBe('success');
    });
  });

  describe('type safety', () => {
    it('should preserve return types', async () => {
      const stringRequest = jest.fn().mockResolvedValue('string');
      const numberRequest = jest.fn().mockResolvedValue(42);
      const objectRequest = jest.fn().mockResolvedValue({key: 'value'});

      const stringResult = await limiter.execute(stringRequest);
      const numberResult = await limiter.execute(numberRequest);
      const objectResult = await limiter.execute(objectRequest);

      // TypeScript should infer correct types
      expect(typeof stringResult).toBe('string');
      expect(typeof numberResult).toBe('number');
      expect(typeof objectResult).toBe('object');

      expect(stringResult).toBe('string');
      expect(numberResult).toBe(42);
      expect(objectResult).toEqual({key: 'value'});
    });
  });
});
