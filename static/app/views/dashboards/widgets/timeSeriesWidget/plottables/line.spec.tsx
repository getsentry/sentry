import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {defined} from 'sentry/utils/defined';

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

  it.each([
    {segmentBy: [], lineStyles: [undefined]},
    {segmentBy: ['completeness'], lineStyles: [undefined, 'dotted']},
    {segmentBy: ['confidence'], lineStyles: [undefined, 'dashed']},
    {
      segmentBy: ['completeness', 'confidence'],
      lineStyles: [undefined, 'dashed', 'dotted'],
    },
  ] as const)('segments by $segmentBy', ({segmentBy, lineStyles}) => {
    const series = new Line(timeSeries).toSeries({...plottingOptions, segmentBy});

    expect(series.map(s => s.lineStyle?.type)).toEqual(lineStyles);
  });

  it.each([
    {segmentBy: [], flags: [{}, {}, {}]},
    {segmentBy: ['completeness'], flags: [{}, {}, {completeness: 'incomplete'}]},
    {segmentBy: ['confidence'], flags: [{}, {confidence: 'low'}, {}]},
  ] as const)('attaches flags for $segmentBy to data points', ({segmentBy, flags}) => {
    const series = new Line(timeSeries).toSeries({...plottingOptions, segmentBy});
    const dataPoints = series.flatMap(s => s.data as Array<Record<string, unknown>>);

    const flagsByTimestamp = new Map(
      dataPoints.map(({value, confidence, completeness}) => [
        (value as [number, number])[0],
        {
          ...(defined(confidence) && {confidence}),
          ...(defined(completeness) && {completeness}),
        },
      ])
    );

    expect(timeSeries.values.map(item => flagsByTimestamp.get(item.timestamp))).toEqual(
      flags
    );
  });
});
