// The backing cache should be a proper LRU cache,
// so we dont end up storing an infinite amount of elements
export class TraceRowWidthMeasurer<T> {
  cache: Map<T, number> = new Map();
  queue: [T, HTMLElement][] = [];
  drainRaf: number | null = null;
  max: number = 0;

  constructor() {
    this.drain = this.drain.bind(this);
  }

  listeners: Record<'max', Set<(max: number) => void>> = {
    max: new Set(),
  };

  on(event: 'max', cb: (max: number) => void) {
    this.listeners?.[event]?.add?.(cb);
  }

  off(event: 'max', cb: (max: number) => void) {
    this.listeners?.[event]?.delete?.(cb);
  }

  dispatch(max: number) {
    for (const listener of this.listeners.max) {
      listener(max);
    }
  }

  enqueueMeasure(node: T, element: HTMLElement) {
    if (this.cache.has(node)) {
      return;
    }

    this.queue.push([node, element]);

    if (this.drainRaf !== null) {
      window.cancelAnimationFrame(this.drainRaf);
    }
    this.drainRaf = window.requestAnimationFrame(this.drain);
  }

  drain() {
    const startMax = this.max;
    while (this.queue.length > 0) {
      const next = this.queue.pop()!;
      const width = this.measure(next[0], next[1]);
      if (width > this.max) {
        this.max = width;
      }
    }

    if (this.max !== startMax) {
      this.dispatch(this.max);
    }
  }

  measure(node: T, element: HTMLElement): number {
    const cache = this.cache.get(node);
    if (cache !== undefined) {
      return cache;
    }

    const rect = element.getBoundingClientRect();
    this.cache.set(node, rect.width);
    return rect.width;
  }
}
