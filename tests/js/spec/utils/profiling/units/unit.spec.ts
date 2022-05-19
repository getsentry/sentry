import {makeTimelineFormatter} from 'sentry/utils/profiling/units/units';

describe('makeTimelineFormatter', () => {
  it('handles base', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(61)).toBe('01:01.000');
  });

  it('formats s', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(1)).toBe('00:01.000');
    expect(formatter(12)).toBe('00:12.000');
  });

  it('formats ms', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(1.543)).toBe('00:01.543');
  });

  it('doesnt overflow template', () => {
    const formatter = makeTimelineFormatter('seconds');
    expect(formatter(1.54355)).toBe('00:01.543');
  });
});
