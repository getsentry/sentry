import {formatTo, makeTimelineFormatter} from 'sentry/utils/profiling/units/units';

describe('makeTimelineFormatter', () => {
  it('handles base', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(61)).toBe('01:01.000');
    expect(formatter(-61)).toBe('-01:01.000');
  });

  it('formats s', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(1)).toBe('00:01.000');
    expect(formatter(12)).toBe('00:12.000');
    expect(formatter(-1)).toBe('-00:01.000');
    expect(formatter(-12)).toBe('-00:12.000');
  });

  it('formats ms', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(1.543)).toBe('00:01.543');
    expect(formatter(-1.543)).toBe('-00:01.543');
  });

  it('doesnt overflow template', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(1.54355)).toBe('00:01.543');
    expect(formatter(-1.54355)).toBe('-00:01.543');
  });
});

describe('formatTo', () => {
  it('works for smaller units', () => {
    expect(formatTo(1, 'seconds', 'milliseconds')).toBe(1000);
    expect(formatTo(1, 'milliseconds', 'seconds')).toBe(0.001);
  });
});
