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

  it('draws complete data normally and incomplete data dotted', () => {
    const series = new Line(timeSeries).toSeries(plottingOptions);

    expect(series.map(s => s.lineStyle?.type)).toEqual([undefined, 'dotted']);
  });

  it('attaches confidence to data points', () => {
    const series = new Line(timeSeries).toSeries(plottingOptions);
    const dataPoints = series.flatMap(s => s.data as Array<Record<string, unknown>>);

    const confidenceByTimestamp = new Map(
      dataPoints.map(({value, confidence}) => [
        (value as [number, number])[0],
        confidence,
      ])
    );

    expect(
      timeSeries.values.map(item => confidenceByTimestamp.get(item.timestamp))
    ).toEqual([undefined, 'low', undefined]);
  });
});
