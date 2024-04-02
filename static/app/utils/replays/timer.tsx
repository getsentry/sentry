/**
 * EventTarget has ~97% browser support
 */
export class Timer extends EventTarget {
  private _id: number | null = null;
  private _active: boolean = false;
  private _start: number = 0;
  private _time: number = 0;
  private _pausedAt: number = 0;
  private _additionalTime: number = 0;
  private _callbacks: Map<number, (() => void)[]> = new Map();

  constructor() {
    super();
  }

  private _stopTimer() {
    if (this._id) {
      window.cancelAnimationFrame(this._id);
    }
    this._active = false;
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
    this._pausedAt = 0;
    this._start = window.performance.now() - (seconds ?? 0);
    this.resume();
  }

  /**
   * Stops timer and moves time to `seconds` if provided
   */
  stop() {
    this._stopTimer();
  }

  pause() {
    if (!this._active) {
      // already paused, do nothing
      return;
    }
    this._pausedAt = window.performance.now();
    this._stopTimer();
  }

  resume() {
    if (this._active) {
      // already active, do nothing
      return;
    }
    this._active = true;

    // adjust for time passing since pausing
    if (this._pausedAt) {
      this._start += window.performance.now() - this._pausedAt;
      this._pausedAt = 0;
    }

    this._id = window.requestAnimationFrame(this.step);
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
