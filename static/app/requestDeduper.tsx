export default class RequestDeduper<T> {
  private requests: Map<string, Promise<T>> = new Map();
  dedupe(url: string, promiseGenerator: () => Promise<T>) {
    const inflight = this.requests.get(url);
    if (inflight) {
      return inflight;
    }
    const promise = promiseGenerator();
    this.requests.set(url, promise);
    return promise.finally(() => {
      this.requests.delete(url);
    });
  }
}
