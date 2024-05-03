import getDuration from 'sentry/utils/duration/getDuration';

describe('getDuration()', () => {
  it('should format durations', () => {
    expect(getDuration(0.1)).toBe('100 milliseconds');
    expect(getDuration(0.1, 2)).toBe('100.00 milliseconds');
    expect(getDuration(1)).toBe('1 second');
    expect(getDuration(2)).toBe('2 seconds');
    expect(getDuration(65)).toBe('1 minute');
    expect(getDuration(122)).toBe('2 minutes');
    expect(getDuration(3720)).toBe('1 hour');
    expect(getDuration(36000)).toBe('10 hours');
    expect(getDuration(86400)).toBe('1 day');
    expect(getDuration(86400 * 2)).toBe('2 days');
    expect(getDuration(604800)).toBe('1 week');
    expect(getDuration(604800 * 4)).toBe('4 weeks');
    expect(getDuration(2629800)).toBe('1 month');
    expect(getDuration(604800 * 12)).toBe('3 months');
  });

  it('should format negative durations', () => {
    expect(getDuration(-0.1)).toBe('-100 milliseconds');
    expect(getDuration(-0.1, 2)).toBe('-100.00 milliseconds');
    expect(getDuration(-1)).toBe('-1 second');
    expect(getDuration(-2)).toBe('-2 seconds');
    expect(getDuration(-65)).toBe('-1 minute');
    expect(getDuration(-122)).toBe('-2 minutes');
    expect(getDuration(-3720)).toBe('-1 hour');
    expect(getDuration(-36000)).toBe('-10 hours');
    expect(getDuration(-86400)).toBe('-1 day');
    expect(getDuration(-86400 * 2)).toBe('-2 days');
    expect(getDuration(-604800)).toBe('-1 week');
    expect(getDuration(-604800 * 4)).toBe('-4 weeks');
    expect(getDuration(-2629800)).toBe('-1 month');
    expect(getDuration(-604800 * 12)).toBe('-3 months');
  });

  it('should format numbers and abbreviate units', () => {
    expect(getDuration(0, 2, true)).toBe('0.00ms');
    expect(getDuration(0, 0, true)).toBe('0ms');
    expect(getDuration(0.1, 0, true)).toBe('100ms');
    expect(getDuration(0.1, 2, true)).toBe('100.00ms');
    expect(getDuration(1, 2, true)).toBe('1.00s');
    expect(getDuration(122, 0, true)).toBe('2min');
    expect(getDuration(3600, 0, true)).toBe('1hr');
    expect(getDuration(86400, 0, true)).toBe('1d');
    expect(getDuration(86400 * 2, 0, true)).toBe('2d');
    expect(getDuration(604800, 0, true)).toBe('1wk');
    expect(getDuration(604800 * 2, 0, true)).toBe('2wk');
    expect(getDuration(2629800, 0, true)).toBe('1mo');
    expect(getDuration(604800 * 12, 0, true)).toBe('3mo');
  });

  it('should format numbers and abbreviate units with one letter', () => {
    expect(getDuration(0, 2, false, true)).toBe('0.00ms');
    expect(getDuration(0, 0, false, true)).toBe('0ms');
    expect(getDuration(0.1, 0, false, true)).toBe('100ms');
    expect(getDuration(0.1, 2, false, true)).toBe('100.00ms');
    expect(getDuration(1, 2, false, true)).toBe('1.00s');
    expect(getDuration(122, 0, false, true)).toBe('2m');
    expect(getDuration(3600, 0, false, true)).toBe('1h');
    expect(getDuration(86400, 0, false, true)).toBe('1d');
    expect(getDuration(86400 * 2, 0, false, true)).toBe('2d');
    expect(getDuration(604800, 0, false, true)).toBe('1w');
    expect(getDuration(604800 * 2, 0, false, true)).toBe('2w');
    expect(getDuration(2629800, 0, false, true)).toBe('4w');
    expect(getDuration(604800 * 12, 0, false, true)).toBe('12w');
  });

  it('should format negative durations with absolute', () => {
    expect(getDuration(-0.1, 0, false, false, true)).toBe('100 milliseconds');
    expect(getDuration(-0.1, 2, false, false, true)).toBe('100.00 milliseconds');
    expect(getDuration(-1, 0, false, false, true)).toBe('1 second');
    expect(getDuration(-2, 0, false, false, true)).toBe('2 seconds');
    expect(getDuration(-65, 0, false, false, true)).toBe('1 minute');
    expect(getDuration(-122, 0, false, false, true)).toBe('2 minutes');
    expect(getDuration(-3720, 0, false, false, true)).toBe('1 hour');
    expect(getDuration(-36000, 0, false, false, true)).toBe('10 hours');
    expect(getDuration(-86400, 0, false, false, true)).toBe('1 day');
    expect(getDuration(-86400 * 2, 0, false, false, true)).toBe('2 days');
    expect(getDuration(-604800, 0, false, false, true)).toBe('1 week');
    expect(getDuration(-604800 * 4, 0, false, false, true)).toBe('4 weeks');
    expect(getDuration(-2629800, 0, false, false, true)).toBe('1 month');
    expect(getDuration(-604800 * 12, 0, false, false, true)).toBe('3 months');
  });
});
