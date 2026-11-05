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

  it.each([
    {segmentBy: [], lineStyles: [undefined]},
    {segmentBy: ['completeness'], lineStyles: [undefined, 'dotted']},
    {segmentBy: ['confidence'], lineStyles: [undefined, 'dashed']},
    {
      segmentBy: ['completeness', 'confidence'],
      lineStyles: [undefined, 'dashed', 'dotted'],
    },
  ] as const)('segments by $segmentBy', ({segmentBy, lineStyles}) => {
    const series = new Line(timeSeries, {segmentBy}).toSeries(plottingOptions);

    expect(series.map(s => s.lineStyle?.type)).toEqual(lineStyles);
  });
});
