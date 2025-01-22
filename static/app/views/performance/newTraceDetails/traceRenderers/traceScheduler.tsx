type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;
type EventStore = {
  [K in keyof TraceEvents]: [number, TraceEvents[K]][];
};

export enum TraceEventPriority {
  LOW = 10,
  MEDIUM = 5,
  HIGH = 1,
}
export interface TraceEvents {
  ['divider resize']: (view: {list: number; span_list: number}) => void;
  ['divider resize end']: (list_width: number) => void;
  ['draw']: (options?: {list?: number; span_list?: number}) => void;
  ['initialize trace space']: (
    space: [x: number, y: number, width: number, height: number]
  ) => void;
  ['initialize virtualized list']: () => void;
  ['set container physical space']: (
    container_space: [x: number, y: number, width: number, height: number]
  ) => void;
  ['set trace space']: (
    space: [x: number, y: number, width: number, height: number]
  ) => void;
  ['set trace view']: (view: {width?: number; x?: number}) => void;
}

export class TraceScheduler {
  events: EventStore = {
    ['initialize virtualized list']: new Array<
      [TraceEventPriority, TraceEvents['initialize virtualized list']]
    >(),
    ['set container physical space']: new Array<
      [TraceEventPriority, TraceEvents['set container physical space']]
    >(),
    ['initialize trace space']: new Array<
      [TraceEventPriority, TraceEvents['initialize trace space']]
    >(),
    ['set trace space']: new Array<
      [TraceEventPriority, TraceEvents['set trace space']]
    >(),
    ['divider resize end']: new Array<
      [TraceEventPriority, TraceEvents['divider resize end']]
    >(),
    ['divider resize']: new Array<[TraceEventPriority, TraceEvents['divider resize']]>(),
    ['set trace view']: new Array<[TraceEventPriority, TraceEvents['set trace view']]>(),
    ['draw']: new Array<[TraceEventPriority, TraceEvents['draw']]>(),
  };

  once<K extends keyof TraceEvents>(eventName: K, cb: TraceEvents[K]) {
    const wrapper = (...args: any[]) => {
      (cb as any)(...args);
      this.off(eventName, wrapper);
    };

    this.on(eventName, wrapper);
  }

  on<K extends keyof TraceEvents>(
    eventName: K,
    cb: TraceEvents[K],
    priority: TraceEventPriority = 10
  ): void {
    const arr = this.events[eventName];
    if (!arr || arr.some(a => a[1] === cb)) {
      return;
    }
    arr.push([priority, cb]);
    arr.sort((a, b) => a[0] - b[0]);
  }

  off<K extends keyof TraceEvents>(eventName: K, cb: TraceEvents[K]): void {
    const arr = this.events[eventName];

    if (!arr) {
      return;
    }

    (this.events as any)[eventName] = arr.filter(a => a[1] !== cb) as unknown as [
      TraceEventPriority,
      K,
    ][];
  }

  dispatch<K extends keyof TraceEvents>(
    eventName: K,
    ...args: ArgumentTypes<TraceEvents[K]>
  ): void {
    for (const [_priority, handler] of this.events[eventName]) {
      (handler as any)(...args);
    }
  }
}
