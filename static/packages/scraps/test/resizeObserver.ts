const liveObservers = new Set<MockResizeObserver>();

export class MockResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;
  private targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    liveObservers.add(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    liveObservers.delete(this);
  }

  notify() {
    if (!this.targets.size) {
      return;
    }

    this.callback(
      Array.from(this.targets, target => ({target}) as ResizeObserverEntry),
      this
    );
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
