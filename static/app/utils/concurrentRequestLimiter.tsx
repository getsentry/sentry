import {uniqueId} from 'sentry/utils/guid';

interface QueuedRequest<T> {
  readonly createdAt: number;
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

interface CancellableRequest<T> {
  readonly cancel: () => void;
  readonly id: string;
  readonly promise: Promise<T>;
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
  private readonly activeRequests = new Map<string, number>();
  private readonly queue: Array<QueuedRequest<unknown>> = [];
  private readonly maxConcurrent: number;
  private cleanupTimer?: number;

  constructor(maxConcurrent = 15) {
    if (maxConcurrent <= 0) {
      throw new Error('maxConcurrent must be greater than 0');
    }
    this.maxConcurrent = maxConcurrent;
    this.startCleanupTimer();
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
        createdAt: Date.now(),
      };
      console.log('request execute', request);

      if (this.hasAvailableSlot()) {
        void this.executeRequest(request);
      } else {
        this.enqueueRequest(request);
      }
    });
  }

  /**
   * Execute a request function with cancellation support.
   * Returns a cancellable request object that can be cancelled before completion.
   *
   * @param requestFn - The async function to execute
   * @returns CancellableRequest with promise, cancel function, and id
   */
  executeCancellable<T>(requestFn: () => Promise<T>): CancellableRequest<T> {
    let isCancelled = false;
    const requestId = uniqueId();

    const promise = new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: requestId,
        execute: async () => {
          if (isCancelled) {
            throw new Error('Request was cancelled');
          }
          return requestFn();
        },
        resolve: (value: T) => {
          if (!isCancelled) {
            resolve(value);
          }
        },
        reject: (error: unknown) => {
          if (!isCancelled) {
            reject(error);
          }
        },
        createdAt: Date.now(),
      };

      if (this.hasAvailableSlot()) {
        void this.executeRequest(request);
      } else {
        this.enqueueRequest(request);
      }
    });

    const cancel = () => {
      isCancelled = true;
      this.cancelRequest(requestId);
    };

    return {promise, cancel, id: requestId};
  }

  /**
   * Cancel a specific request by ID.
   * Removes the request from active or queued state.
   *
   * @param requestId - The ID of the request to cancel
   * @returns true if request was found and cancelled, false otherwise
   */
  cancelRequest(requestId: string): boolean {
    // Cancel if active
    if (this.activeRequests.has(requestId)) {
      this.activeRequests.delete(requestId);
      this.processNextInQueue();
      return true;
    }

    // Cancel if queued
    const queueIndex = this.queue.findIndex(req => req.id === requestId);
    if (queueIndex !== -1) {
      const request = this.queue[queueIndex];
      if (request) {
        request.reject(new Error('Request cancelled'));
        this.queue.splice(queueIndex, 1);
      }
      return true;
    }

    return false;
  }

  private hasAvailableSlot(): boolean {
    return this.activeRequests.size < this.maxConcurrent;
  }

  private enqueueRequest<T>(request: QueuedRequest<T>): void {
    this.queue.push(request as QueuedRequest<unknown>);
  }

  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    this.activeRequests.set(request.id, Date.now());

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
   * Clean up stale requests that may have been cancelled or timed out
   */
  private cleanup(): void {
    const now = Date.now();
    const STALE_TIMEOUT = 30000; // 30 seconds
    const QUEUE_TIMEOUT = 60000; // 1 minute

    // Clean up stale active requests
    for (const [id, startTime] of this.activeRequests) {
      if (now - startTime > STALE_TIMEOUT) {
        this.activeRequests.delete(id);
      }
    }

    // Clean up stale queued requests
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const request = this.queue[i];
      if (request && now - request.createdAt > QUEUE_TIMEOUT) {
        request.reject(new Error('Request timed out in queue'));
        this.queue.splice(i, 1);
      }
    }

    // Process queue if we freed up slots
    this.processNextInQueue();
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, 10000); // Run every 10 seconds
  }

  /**
   * Stop the cleanup timer and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
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

/**
 * Component-scoped limiter that automatically handles request lifecycle
 * without requiring manual state management in components.
 */
export class ComponentScopedLimiter {
  private readonly requests = new Map<string, () => void>(); // requestId -> cancel function
  private readonly limiter: ConcurrentRequestLimiter;

  constructor(limiter: ConcurrentRequestLimiter) {
    this.limiter = limiter;
  }

  /**
   * Execute a request with automatic tracking and cleanup.
   * The request will be automatically cancelled if the component is destroyed.
   */
  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    const cancellableRequest = this.limiter.executeCancellable(requestFn);

    // Auto-track with cleanup function
    this.requests.set(cancellableRequest.id, cancellableRequest.cancel);

    try {
      const result = await cancellableRequest.promise;
      return result;
    } finally {
      // Clean up tracking when request completes
      this.requests.delete(cancellableRequest.id);
    }
  }

  /**
   * Cancel all active requests managed by this component limiter.
   */
  cancelAll(): void {
    this.requests.forEach(cancel => cancel());
    this.requests.clear();
  }

  /**
   * Destroy the component limiter and cancel all requests.
   * Should be called in componentWillUnmount or cleanup.
   */
  destroy(): void {
    this.cancelAll();
  }

  /**
   * Get the number of active requests for this component.
   */
  getActiveCount(): number {
    return this.requests.size;
  }
}

// Global instance for dashboard queries
export const dashboardRequestLimiter = new ConcurrentRequestLimiter(15);

// Cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    dashboardRequestLimiter.destroy();
  });
}
