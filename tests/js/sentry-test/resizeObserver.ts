const liveObservers = new Set<MockResizeObserver>();

export class MockResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    liveObservers.add(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {
    liveObservers.delete(this);
  }

  notify() {
    this.callback([], this);
  }
}

/**
 * Invoke every observer that is currently connected, as the browser does after
 * a layout change. Stub the element geometry the code under test reads before
 * calling this — jsdom reports every element as zero-sized.
 */
export function triggerResizeObservers() {
  for (const observer of liveObservers) {
    observer.notify();
  }
}

export function resetResizeObservers() {
  liveObservers.clear();
}
