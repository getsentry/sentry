type ReplayPlayerTimestampChangeEvent = {
  currentHoverTime: number | undefined;
  currentTime: number;
};
type ReplayPlayerListener = (arg: ReplayPlayerTimestampChangeEvent) => void;

class ReplayPlayerTimestampEmitter {
  private listeners: {[key: string]: Set<ReplayPlayerListener>} = {};

  on(event: 'replay timestamp change', handler: ReplayPlayerListener): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(handler);
  }

  emit(event: 'replay timestamp change', arg: ReplayPlayerTimestampChangeEvent): void {
    const handlers = this.listeners[event] || [];
    handlers.forEach(handler => handler(arg));
  }

  off(event: 'replay timestamp change', handler: ReplayPlayerListener): void {
    const handlers = this.listeners[event];

    if (!handlers) {
      return;
    }

    handlers.delete?.(handler);
  }
}

/**
 * @deprecated This emitter is a singleton that sends some global state around.
 * If there are multiple replay instances on the page values will be confusing.
 * A better implementation would nest the consumer under the same
 * <ReplayCurrentTimeContextProvider> ancestor node.
 */
export const replayPlayerTimestampEmitter = new ReplayPlayerTimestampEmitter();
