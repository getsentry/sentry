type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;
type EventStore = {
  [K in keyof TraceEvents]: Set<TraceEvents[K]>;
};

interface TraceEvents {
  ['divider resize end']: (list_width: number) => void;
}

export class TraceScheduler {
  events: EventStore = {
    ['divider resize end']: new Set<TraceEvents['divider resize end']>(),
  };

  once<K extends keyof TraceEvents>(eventName: K, cb: Function) {
    const wrapper = (...args: any[]) => {
      cb(...args);
      this.off(eventName, wrapper);
    };
    this.on(eventName, wrapper);
  }

  on<K extends keyof TraceEvents>(eventName: K, cb: TraceEvents[K]): void {
    const set = this.events[eventName] as unknown as Set<TraceEvents[K]>;
    if (set.has(cb)) {
      return;
    }
    set.add(cb);
  }

  off<K extends keyof TraceEvents>(eventName: K, cb: TraceEvents[K]): void {
    const set = this.events[eventName] as unknown as Set<TraceEvents[K]>;

    if (set.has(cb)) {
      set.delete(cb);
    }
  }

  dispatch<K extends keyof TraceEvents>(
    event: K,
    ...args: ArgumentTypes<TraceEvents[K]>
  ): void {
    for (const handler of this.events[event]) {
      // @ts-expect-error
      handler(...args);
    }
  }
}
