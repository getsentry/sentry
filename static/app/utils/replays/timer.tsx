/**
 * EventTarget has ~97% browser support
 */
export class Timer extends EventTarget {
  private _id: number | null = null;
  private _active: boolean = false;
  private _start: number = 0;
  private _time: number = 0;
  private _additionalTime: number = 0;
  private _callbacks: Map<number, (() => void)[]> = new Map();

  constructor() {
    super();
  }

  step = () => {
    if (!this._active) {
      return;
    }

    this._time = window.performance.now() - this._start;
    // We don't expect _callbacks to be very large, so we can deal with a
    // linear search
    this._callbacks.forEach((value, key, callbacks) => {
      if (this._time >= key) {
        // Call every callback and then clear the callbacks at offset
        value.forEach(callback => callback());
        callbacks.set(key, []);
      }
    });
    this._id = window.requestAnimationFrame(this.step);
  };

  /**
   * @param seconds The number of seconds to start at
   */
  start(seconds?: number) {
    this._start = window.performance.now() - (seconds ?? 0);
    this._active = true;
    this._id = window.requestAnimationFrame(this.step);
  }

  /**
   * Stops timer and moves time to `seconds` if provided
   */
  stop(seconds?: number) {
    if (seconds !== undefined) {
      this._time = seconds;
    }
    if (this._id) {
      window.cancelAnimationFrame(this._id);
    }
    this._active = false;
  }

  reset() {
    this.stop();
    this._start = 0;
    this._time = 0;
  }

  getTime() {
    return this._time + this._additionalTime;
  }

  isActive() {
    return this._active;
  }

  addNotificationAtTime(offset: number, callback: () => void) {
    // Can't notify going backwards in time
    if (offset <= this._time) {
      return;
    }

    if (!this._callbacks.has(offset)) {
      this._callbacks.set(offset, []);
    }

    const callbacksAtOffset = this._callbacks.get(offset)!;
    callbacksAtOffset.push(callback);
    this._callbacks.set(offset, callbacksAtOffset);
  }
}
