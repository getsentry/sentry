/**
 * Global concurrent request limiter to prevent overwhelming the server
 * with too many simultaneous requests.
 */

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  id: string;
  reject: (error: any) => void;
  resolve: (value: T) => void;
}

class ConcurrentRequestLimiter {
  private activeRequests = new Set<string>();
  private queue: Array<QueuedRequest<any>> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent = 15) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Execute a request function with concurrent limiting.
   * If the limit is reached, the request will be queued.
   */
  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    const requestId = Math.random().toString(36).substring(2, 15);

    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: requestId,
        execute: requestFn,
        resolve,
        reject,
      };

      if (this.activeRequests.size < this.maxConcurrent) {
        this.executeRequest(request);
      } else {
        this.queue.push(request);
      }
    });
  }

  private async executeRequest<T>(request: QueuedRequest<T>) {
    this.activeRequests.add(request.id);

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests.delete(request.id);
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
      const nextRequest = this.queue.shift()!;
      this.executeRequest(nextRequest);
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
   * Get stats for debugging
   */
  getStats() {
    return {
      active: this.activeRequests.size,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Global instance for discover queries
export const discoverRequestLimiter = new ConcurrentRequestLimiter(15);
