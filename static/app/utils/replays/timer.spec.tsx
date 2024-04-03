import {Timer} from './timer';

jest.useFakeTimers();

describe('Replay Timer', () => {
  it('handles multiple callbacks', () => {
    const timer = new Timer();
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const spy3 = jest.fn();
    const spy4 = jest.fn();

    timer.addNotificationAtTime(4000, spy3);
    timer.addNotificationAtTime(1000, spy1);
    timer.addNotificationAtTime(1000, spy2);
    timer.addNotificationAtTime(2000, spy4);

    timer.start();
    // Syncs with RAF, so each tick of the timer should be +16ms
    jest.advanceTimersByTime(1008);
    timer.stop();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
    expect(spy3).toHaveBeenCalledTimes(0);
    expect(spy4).toHaveBeenCalledTimes(0);
  });
});
