import {mat3} from 'gl-matrix';

import {Rect} from './gl/utils';
import {FlamegraphFrame} from './flamegraphFrame';

type DrawFn = () => void;
type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;

export interface FlamegraphEvents {
  ['highlight frame']: (
    frame: FlamegraphFrame[] | null,
    mode: 'hover' | 'selected'
  ) => void;
  ['reset zoom']: () => void;
  ['set config view']: (configView: Rect) => void;
  ['transform config view']: (transform: mat3) => void;
  ['zoom at frame']: (frame: FlamegraphFrame, strategy: 'min' | 'exact') => void;
}

type EventStore = {[K in keyof FlamegraphEvents]: Set<FlamegraphEvents[K]>};

export class CanvasScheduler {
  beforeFrameCallbacks: Set<DrawFn> = new Set();
  afterFrameCallbacks: Set<DrawFn> = new Set();

  onDisposeCallbacks: Set<() => void> = new Set();
  requestAnimationFrame: number | null = null;

  events: EventStore = {
    ['reset zoom']: new Set<FlamegraphEvents['reset zoom']>(),
    ['highlight frame']: new Set<FlamegraphEvents['highlight frame']>(),
    ['set config view']: new Set<FlamegraphEvents['set config view']>(),
    ['transform config view']: new Set<FlamegraphEvents['transform config view']>(),
    ['zoom at frame']: new Set<FlamegraphEvents['zoom at frame']>(),
  };

  onDispose(cb: () => void): void {
    if (this.onDisposeCallbacks.has(cb)) {
      return;
    }

    this.onDisposeCallbacks.add(cb);
  }

  on<K extends keyof FlamegraphEvents>(eventName: K, cb: FlamegraphEvents[K]): void {
    const set = this.events[eventName] as unknown as Set<FlamegraphEvents[K]>;
    if (set.has(cb)) {
      return;
    }
    set.add(cb);
  }

  off<K extends keyof FlamegraphEvents>(eventName: K, cb: FlamegraphEvents[K]): void {
    const set = this.events[eventName] as unknown as Set<FlamegraphEvents[K]>;

    if (set.has(cb)) {
      set.delete(cb);
    }
  }

  dispatch<K extends keyof FlamegraphEvents>(
    event: K,
    ...args: ArgumentTypes<FlamegraphEvents[K]>
  ): void {
    for (const handler of this.events[event]) {
      // @ts-ignore
      handler(...args);
    }
  }

  private registerCallback(cb: DrawFn, pool: Set<DrawFn>) {
    if (pool.has(cb)) {
      return;
    }
    pool.add(cb);
  }

  private unregisterCallback(cb: DrawFn, pool: Set<DrawFn>) {
    if (pool.has(cb)) {
      pool.delete(cb);
    }
  }

  registerBeforeFrameCallback(cb: DrawFn): void {
    this.registerCallback(cb, this.beforeFrameCallbacks);
  }
  unregisterBeforeFrameCallback(cb: DrawFn): void {
    this.unregisterCallback(cb, this.beforeFrameCallbacks);
  }
  registerAfterFrameCallback(cb: DrawFn): void {
    this.registerCallback(cb, this.afterFrameCallbacks);
  }
  unregisterAfterFrameCallback(cb: DrawFn): void {
    this.unregisterCallback(cb, this.afterFrameCallbacks);
  }

  dispose(): void {
    for (const cb of this.onDisposeCallbacks) {
      this.onDisposeCallbacks.delete(cb);
      cb();
    }
    for (const type in this.events) {
      this.events[type].clear();
    }
  }

  drawSync(): void {
    for (const cb of this.beforeFrameCallbacks) {
      cb();
    }

    for (const cb of this.afterFrameCallbacks) {
      cb();
    }
  }

  draw(): void {
    if (this.requestAnimationFrame) {
      window.cancelAnimationFrame(this.requestAnimationFrame);
    }

    this.requestAnimationFrame = window.requestAnimationFrame(() => {
      for (const cb of this.beforeFrameCallbacks) {
        cb();
      }

      for (const cb of this.afterFrameCallbacks) {
        cb();
      }
      this.requestAnimationFrame = null;
    });
  }
}

export class CanvasPoolManager {
  schedulers: Set<CanvasScheduler> = new Set();

  registerScheduler(scheduler: CanvasScheduler): void {
    if (this.schedulers.has(scheduler)) {
      return;
    }
    this.schedulers.add(scheduler);
  }

  dispatch<K extends keyof FlamegraphEvents>(
    event: K,
    args: ArgumentTypes<FlamegraphEvents[K]>
  ): void {
    for (const scheduler of this.schedulers) {
      scheduler.dispatch(event, ...args);
    }
  }

  unregisterScheduler(scheduler: CanvasScheduler): void {
    if (this.schedulers.has(scheduler)) {
      scheduler.dispose();
      this.schedulers.delete(scheduler);
    }
  }

  drawSync(): void {
    for (const scheduler of this.schedulers) {
      scheduler.drawSync();
    }
  }

  draw(): void {
    for (const scheduler of this.schedulers) {
      scheduler.draw();
    }
  }
}
