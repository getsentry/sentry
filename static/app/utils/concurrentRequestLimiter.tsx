import {uniqueId} from 'sentry/utils/guid';

interface QueuedRequest<T> {
  readonly execute: () => Promise<T>;
  readonly id: string;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: T) => void;
}

interface LimiterStats {
  readonly active: number;
  readonly maxConcurrent: number;
  readonly queued: number;
}

/**
 * A concurrent request limiter that queues requests when a maximum
 * number of concurrent requests is reached.
 *
 * This is useful for situations where a page conducts many requests at once,
 * such as a custom dashboard. Implementing exponential backoff may not be
 * sufficient without this class because we require that in-flight requests
 * complete before the next request is executed.
 */
export class ConcurrentRequestLimiter {
  private readonly activeRequests = new Set<string>();
  private readonly queue: Array<QueuedRequest<unknown>> = [];
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 15) {
    if (maxConcurrent <= 0) {
      throw new Error('maxConcurrent must be greater than 0');
    }
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Execute a request function with concurrent limiting.
   * If the limit is reached, the request will be queued and executed
   * when a slot becomes available.
   *
   * @param requestFn - The async function to execute
   * @returns Promise that resolves with the result of requestFn
   */
  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: uniqueId(),
        execute: requestFn,
        resolve,
        reject,
      };

      if (this.hasAvailableSlot()) {
        void this.executeRequest(request);
      } else {
        this.enqueueRequest(request);
      }
    });
  }

  private hasAvailableSlot(): boolean {
    return this.activeRequests.size < this.maxConcurrent;
  }

  private enqueueRequest<T>(request: QueuedRequest<T>): void {
    this.queue.push(request as QueuedRequest<unknown>);
  }

  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    this.activeRequests.add(request.id);

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error: unknown) {
      request.reject(error);
    } finally {
      this.activeRequests.delete(request.id);
      this.processNextInQueue();
    }
  }

  private processNextInQueue(): void {
    if (this.queue.length > 0 && this.hasAvailableSlot()) {
      const nextRequest = this.queue.shift();
      if (nextRequest) {
        void this.executeRequest(nextRequest);
      }
    }
  }

  /**
   * Get the current number of active requests
   */
  getActiveCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get comprehensive stats for debugging
   */
  getStats(): LimiterStats {
    return {
      active: this.activeRequests.size,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    } as const;
  }
}

// Global instance for dashboard queries
export const dashboardRequestLimiter = new ConcurrentRequestLimiter(15);
