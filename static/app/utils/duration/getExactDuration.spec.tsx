import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

describe('getExactDuration', () => {
  it('should provide default value', () => {
    expect(getExactDuration(0)).toBe('0 milliseconds');
  });

  it('should format durations without extra suffixes', () => {
    expect(getExactDuration(2.030043848568126)).toBe('2 seconds 30 milliseconds');
    expect(getExactDuration(0.2)).toBe('200 milliseconds');
    expect(getExactDuration(13)).toBe('13 seconds');
    expect(getExactDuration(60)).toBe('1 minute');
    expect(getExactDuration(121)).toBe('2 minutes 1 second');
    expect(getExactDuration(234235435)).toBe(
      '387 weeks 2 days 1 hour 23 minutes 55 seconds'
    );
  });

  it('should format negative durations', () => {
    expect(getExactDuration(-2.030043848568126)).toBe('-2 seconds 30 milliseconds');
    expect(getExactDuration(-0.2)).toBe('-200 milliseconds');
    expect(getExactDuration(-13)).toBe('-13 seconds');
    expect(getExactDuration(-60)).toBe('-1 minute');
    expect(getExactDuration(-121)).toBe('-2 minutes 1 second');
    expect(getExactDuration(-234235435)).toBe(
      '-387 weeks 2 days 1 hour 23 minutes 55 seconds'
    );
  });

  it('should abbreviate label', () => {
    expect(getExactDuration(234235435, true)).toBe('387wk 2d 1hr 23min 55s');
  });

  it('should pin/truncate to the min suffix precision if provided', () => {
    expect(getExactDuration(0, false, 'seconds')).toBe('0 seconds');
    expect(getExactDuration(0.2, false, 'seconds')).toBe('0 seconds');
    expect(getExactDuration(2.030043848568126, false, 'seconds')).toBe('2 seconds');
    expect(getExactDuration(13, false, 'seconds')).toBe('13 seconds');
    expect(getExactDuration(60, false, 'seconds')).toBe('1 minute');
    expect(getExactDuration(121, false, 'seconds')).toBe('2 minutes 1 second');
    expect(getExactDuration(234235435.2, false, 'seconds')).toBe(
      '387 weeks 2 days 1 hour 23 minutes 55 seconds'
    );
  });
});
