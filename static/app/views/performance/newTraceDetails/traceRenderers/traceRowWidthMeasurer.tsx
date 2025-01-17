type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;
type EventStore<T> = {
  [K in keyof TraceRowWidthMeasurerEvents<T>]: Set<TraceRowWidthMeasurerEvents<T>[K]>;
};
interface TraceRowWidthMeasurerEvents<T> {
  ['max']: (max: number) => void;
  ['row measure']: (row: T) => void;
  ['row measure end']: () => void;
}

export class TraceRowWidthMeasurer<T> {
  cache: Map<T, number> = new Map();
  queue: [T, HTMLElement][] = [];
  drainRaf: number | null = null;
  max: number = 0;

  constructor() {
    this.drain = this.drain.bind(this);
  }

  listeners: EventStore<T> = {
    max: new Set(),
    'row measure': new Set(),
    'row measure end': new Set(),
  };

  once<K extends keyof TraceRowWidthMeasurerEvents<T>>(
    event: K,
    cb: (max: number) => void
  ) {
    const listener = (...args: any[]) => {
      cb(...(args as ArgumentTypes<typeof cb>));
      this.off(event, listener);
    };
    this.on(event, listener);
  }

  on<K extends keyof TraceRowWidthMeasurerEvents<T>>(
    eventName: K,
    cb: TraceRowWidthMeasurerEvents<T>[K]
  ): void {
    this.listeners?.[eventName]?.add?.(cb);
  }

  off<K extends keyof TraceRowWidthMeasurerEvents<T>>(
    eventName: K,
    cb: TraceRowWidthMeasurerEvents<T>[K]
  ): void {
    this.listeners?.[eventName]?.delete?.(cb);
  }

  dispatch<K extends keyof TraceRowWidthMeasurerEvents<T>>(
    event: K,
    ...args: ArgumentTypes<TraceRowWidthMeasurerEvents<T>[K]>
  ): void {
    if (!this.listeners[event] || this.listeners[event].size === 0) {
      return;
    }

    for (const handler of this.listeners[event]) {
      (handler as any)(...args);
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
      this.dispatch('max', this.max);
    }

    this.dispatch('row measure end');
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
