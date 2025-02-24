/**
 * EventTarget has ~97% browser support
 */
export class Timer extends EventTarget {
  private _id: number | null = null;
  private _active = false;
  private _start = 0;
  private _time = 0;
  private _pausedAt = 0;
  private _additionalTime = 0;
  private _callbacks: Map<number, Array<() => void>> = new Map();
  private _speed = 1;

  step = () => {
    if (!this._active) {
      return;
    }

    this._time = (window.performance.now() - this._start) * this._speed;
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
    // we're dividing by the speed here because we multiply
    // by the same factor up in step(). doing the math,
    // you'll see that this._time turns out to be just `seconds`.
    this._start = window.performance.now() - (seconds ?? 0) / this._speed;
    this.resume();
    this.step();
  }

  /**
   * Stops/pauses timer, can use `resume` to restart
   */
  stop() {
    if (!this._active) {
      // already paused, do nothing
      return;
    }
    this._pausedAt = window.performance.now();
    if (this._id) {
      window.cancelAnimationFrame(this._id);
    }
    this._active = false;
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
    this._pausedAt = 0;
  }

  /**
   * Allow updating `_time` directly. Needed for replay in the case
   * where we seek to a place in the replay before we start the
   * replay. `play()` in ReplayContext will call `this.getTime()`
   * when the play button is pressed, so we need to have the correct
   * playtime to start at.
   */
  setTime(time: number) {
    this._time = time;
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

  setSpeed(speed: number) {
    this._speed = speed;
  }
}
