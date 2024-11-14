import {
  formatTo,
  fromNanoJoulesToWatts,
  makeFormatter,
  makeTimelineFormatter,
} from 'sentry/utils/profiling/units/units';

describe('makeTimelineFormatter', () => {
  it('handles base', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(61)).toBe('01:01.000');
    expect(formatter(-61)).toBe('-01:01.000');
  });

  it('converts nanojoules to watts', () => {
    // 1e9 nanojoules in 1 second = 1 watt
    expect(fromNanoJoulesToWatts(1e9, 1)).toBe(1);
    // 1e9 nanojoules in 100ms = 10 watts
    expect(fromNanoJoulesToWatts(1e9, 0.1)).toBe(10);
  });

  it('nanojoules', () => {
    const formatter = makeFormatter('nanojoules');
    expect(formatter(1e9)).toBe(`1.00J`);
    expect(formatter(1e12)).toBe(`1.00kJ`);
    expect(formatter(1e15)).toBe(`1.00MJ`);
    expect(formatter(1e18)).toBe(`1.00GJ`);
  });

  it('watts', () => {
    const formatter = makeFormatter('watt');
    expect(formatter(0.1)).toBe(`0.10W`);
    expect(formatter(1)).toBe(`1.00W`);
    expect(formatter(1e3)).toBe(`1.00kW`);
    expect(formatter(1e6)).toBe(`1.00MW`);
    expect(formatter(1e9)).toBe(`1.00GW`);
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
