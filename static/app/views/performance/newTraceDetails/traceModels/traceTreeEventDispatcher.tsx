import type {TraceTree} from './traceTree';

type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;
export class TraceTreeEventDispatcher {
  listeners: {[K in keyof TraceTree.TraceTreeEvents]: Set<TraceTree.TraceTreeEvents[K]>} =
    {
      'trace timeline change': new Set(),
    };

  on<K extends keyof TraceTree.TraceTreeEvents>(
    event: K,
    cb: TraceTree.TraceTreeEvents[K]
  ): void {
    this.listeners[event].add(cb);
  }

  off<K extends keyof TraceTree.TraceTreeEvents>(
    event: K,
    cb: TraceTree.TraceTreeEvents[K]
  ): void {
    this.listeners[event].delete(cb);
  }

  dispatch<K extends keyof TraceTree.TraceTreeEvents>(
    event: K,
    ...args: ArgumentTypes<TraceTree.TraceTreeEvents[K]>
  ): void {
    if (!this.listeners[event]) {
      return;
    }

    for (const handler of this.listeners[event]) {
      // @ts-expect-error TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
      handler(...args);
    }
  }
}
