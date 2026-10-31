import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {Line} from './line';

describe('Line', () => {
  const timeSeries = TimeSeriesFixture({
    values: [
      {timestamp: 1729796400000, value: 10},
      {timestamp: 1729798200000, value: 20, confidence: 'low'},
      {timestamp: 1729800000000, value: 30, incomplete: true},
    ],
  });

  const plottingOptions = {
    color: '#7553FF',
    unit: timeSeries.meta.valueUnit,
    yAxisPosition: 'left' as const,
  };

  it('ignores low confidence data when not enabled', () => {
    const series = new Line(timeSeries).toSeries(plottingOptions);

    expect(series.map(s => s.lineStyle?.type)).toEqual([undefined, 'dotted']);
  });

  it('draws low confidence segments dashed when enabled', () => {
    const series = new Line(timeSeries).toSeries({
      ...plottingOptions,
      showLowConfidence: true,
    });

    expect(series.map(s => s.lineStyle?.type)).toEqual([undefined, 'dashed', 'dotted']);
  });
});
