import {Timer} from './timer';

vi.useRealTimers();
vi.useFakeTimers();

describe('Replay Timer', () => {
  it('works', () => {
    const timer = new Timer();

    timer.start();
    vi.advanceTimersByTime(1008);

    timer.stop();
    expect(timer.getTime()).toBe(1008);
    vi.advanceTimersByTime(1008);
    expect(timer.getTime()).toBe(1008);

    timer.resume();
    vi.advanceTimersByTime(1008);
    timer.stop();
    expect(timer.getTime()).toBe(2016);
  });

  it('sets a custom time', () => {
    const timer = new Timer();

    timer.setTime(5678);
    expect(timer.getTime()).toBe(5678);
    vi.advanceTimersByTime(1008);
    // not started yet
    expect(timer.getTime()).toBe(5678);

    // starting the timer will wipe out the set time!
    timer.start();
    expect(timer.getTime()).toBe(0);
    vi.advanceTimersByTime(1008);
    expect(timer.getTime()).toBe(1008);

    // so that the timer doesn't infinitely run
    timer.stop();
  });

  it('handles multiple callbacks', () => {
    const timer = new Timer();
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const spy3 = vi.fn();
    const spy4 = vi.fn();

    timer.addNotificationAtTime(4000, spy3);
    timer.addNotificationAtTime(1000, spy1);
    timer.addNotificationAtTime(1000, spy2);
    timer.addNotificationAtTime(2000, spy4);

    timer.start();
    // Syncs with RAF, so each tick of the timer should be +16ms
    vi.advanceTimersByTime(1008);
    timer.stop();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
    expect(spy3).toHaveBeenCalledTimes(0);
    expect(spy4).toHaveBeenCalledTimes(0);
  });
});
