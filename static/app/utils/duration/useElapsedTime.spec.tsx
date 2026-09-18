import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  formatElapsedSeconds,
  getElapsedMilliseconds,
  useElapsedTime,
} from 'sentry/utils/duration/useElapsedTime';

describe('getElapsedMilliseconds', () => {
  it('measures between any mix of dates, timestamps, and ISO strings', () => {
    expect(
      getElapsedMilliseconds('2025-01-01T00:00:00Z', '2025-01-01T00:00:01.500Z')
    ).toBe(1500);
    expect(
      getElapsedMilliseconds(
        new Date('2025-01-01T00:00:00Z'),
        Date.parse('2025-01-01T00:00:02Z')
      )
    ).toBe(2000);
  });

  it('returns null when there is nothing real to measure', () => {
    expect(getElapsedMilliseconds(null, '2025-01-01T00:00:01Z')).toBeNull();
    expect(getElapsedMilliseconds('2025-01-01T00:00:00Z', undefined)).toBeNull();
    expect(getElapsedMilliseconds('not-a-date', '2025-01-01T00:00:01Z')).toBeNull();
    // Running backwards is a bad pair, not a negative duration.
    expect(
      getElapsedMilliseconds('2025-01-01T00:00:05Z', '2025-01-01T00:00:01Z')
    ).toBeNull();
  });
});

describe('useElapsedTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:05Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts up while no end is known', () => {
    const {result} = renderHook(() => useElapsedTime('2025-01-01T00:00:00Z', undefined));

    expect(result.current).toBe(5000);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe(5300);
  });

  it('stops at the end once there is one', () => {
    const {result} = renderHook(() =>
      useElapsedTime('2025-01-01T00:00:00Z', '2025-01-01T00:00:02Z')
    );

    expect(result.current).toBe(2000);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(2000);
  });

  it('does not count when told the work is not active', () => {
    const {result} = renderHook(() =>
      useElapsedTime('2025-01-01T00:00:00Z', null, {active: false})
    );

    expect(result.current).toBeNull();
  });
});

describe('formatElapsedSeconds', () => {
  it('stays in seconds rather than dropping to milliseconds', () => {
    expect(formatElapsedSeconds(400)).toBe('0.4s');
    expect(formatElapsedSeconds(12_300)).toBe('12.3s');
  });

  it('rolls up past a minute', () => {
    expect(formatElapsedSeconds(90_000)).toBe('1.5min');
  });
});
