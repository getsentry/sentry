import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {isTimeSeriesOther} from './isTimeSeriesOther';

describe('isTimeSeriesOther', () => {
  it('treats normal time series as not other', () => {
    expect(isTimeSeriesOther(TimeSeriesFixture())).toBeFalsy();
  });

  it('treats the title "Other" as other', () => {
    expect(
      isTimeSeriesOther(
        TimeSeriesFixture({
          yAxis: 'Other',
        })
      )
    ).toBeTruthy();
  });

  it('treats top N "Other" as other', () => {
    expect(
      isTimeSeriesOther(
        TimeSeriesFixture({
          yAxis: 'eps() : Other',
        })
      )
    ).toBeTruthy();
  });
});
