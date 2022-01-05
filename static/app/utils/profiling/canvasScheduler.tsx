import {mat3} from 'gl-matrix';

import {Rect} from './gl/utils';

type DrawFn = () => void;
type ArgumentTypes<F> = F extends (args: infer A) => any ? A : never;

export interface FlamegraphEvents<T> {
  transformConfigView: (transform: mat3) => void;
  setConfigView: (configView: Rect) => void;
  zoomIntoFrame: (frame: T) => void;
  selectedNode: (frame: T | null) => void;
  resetZoom: () => void;
}

export class CanvasScheduler<T> {
  beforeFrameCallbacks: Set<DrawFn> = new Set();
  afterFrameCallbacks: Set<DrawFn> = new Set();
  requestAnimationFrame: number | null = null;

  events: {
    [K in keyof FlamegraphEvents<T>]: Set<FlamegraphEvents<T>[K]>;
  } = {
    setConfigView: new Set<FlamegraphEvents<T>['setConfigView']>(),
    transformConfigView: new Set<FlamegraphEvents<T>['transformConfigView']>(),
    zoomIntoFrame: new Set<FlamegraphEvents<T>['zoomIntoFrame']>(),
    selectedNode: new Set<FlamegraphEvents<T>['selectedNode']>(),
    resetZoom: new Set<FlamegraphEvents<T>['resetZoom']>(),
  };

  on<K extends keyof FlamegraphEvents<T>>(
    eventName: K,
    cb: FlamegraphEvents<T>[K]
  ): void {
    const set = this.events[eventName] as unknown as Set<FlamegraphEvents<T>[K]>;
    if (set.has(cb)) return;
    set.add(cb);
  }

  off<K extends keyof FlamegraphEvents<T>>(
    eventName: K,
    cb: FlamegraphEvents<T>[K]
  ): void {
    const set = this.events[eventName] as unknown as Set<FlamegraphEvents<T>[K]>;
    if (!set.has(cb)) return;
    set.delete(cb);
  }

  dispatch<K extends keyof FlamegraphEvents<T>>(
    event: K,
    args: ArgumentTypes<FlamegraphEvents<T>[K]>
  ): void {
    for (const handler of this.events[event]) {
      handler(args);
    }
  }

  private registerCallback(cb: DrawFn, pool: Set<DrawFn>) {
    if (pool.has(cb)) return;
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

export class CanvasPoolManager<T> {
  schedulers: Set<CanvasScheduler<T>> = new Set();

  registerScheduler(scheduler: CanvasScheduler<T>): void {
    if (this.schedulers.has(scheduler)) return;
    this.schedulers.add(scheduler);
  }

  dispatch<K extends keyof FlamegraphEvents<T>>(
    event: K,
    args: ArgumentTypes<FlamegraphEvents<T>[K]>
  ): void {
    for (const scheduler of this.schedulers) {
      scheduler.dispatch(event, args);
    }
  }

  unregisterScheduler(scheduler: CanvasScheduler<T>): void {
    if (this.schedulers.has(scheduler)) {
      scheduler.dispose();
      this.schedulers.delete(scheduler);
    }
  }
}
