import getExactDuration from 'sentry/utils/duration/getExactDuration';

describe('getExactDuration', () => {
  it('should provide default value', () => {
    expect(getExactDuration(0)).toEqual('0 milliseconds');
  });

  it('should format in the right way', () => {
    expect(getExactDuration(2.030043848568126)).toEqual('2 seconds 30 milliseconds');
    expect(getExactDuration(0.2)).toEqual('200 milliseconds');
    expect(getExactDuration(13)).toEqual('13 seconds');
    expect(getExactDuration(60)).toEqual('1 minute');
    expect(getExactDuration(121)).toEqual('2 minutes 1 second');
    expect(getExactDuration(234235435)).toEqual(
      '387 weeks 2 days 1 hour 23 minutes 55 seconds'
    );
  });

  it('should format negative durations', () => {
    expect(getExactDuration(-2.030043848568126)).toEqual('-2 seconds -30 milliseconds');
    expect(getExactDuration(-0.2)).toEqual('-200 milliseconds');
    expect(getExactDuration(-13)).toEqual('-13 seconds');
    expect(getExactDuration(-60)).toEqual('-1 minute');
    expect(getExactDuration(-121)).toEqual('-2 minutes -1 second');
    expect(getExactDuration(-234235435)).toEqual(
      '-387 weeks -2 days -1 hour -23 minutes -55 seconds'
    );
  });

  it('should abbreviate label', () => {
    expect(getExactDuration(234235435, true)).toEqual('387wk 2d 1hr 23min 55s');
  });
});
