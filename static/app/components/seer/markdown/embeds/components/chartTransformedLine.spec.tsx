import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {TransformedLine} from './chartTransformedLine';

describe('TransformedLine', () => {
  it('marks isolated observed and derived values, including zero', () => {
    const timeSeries: TimeSeries = {
      yAxis: 'errors',
      meta: {valueType: 'number', valueUnit: null, interval: 1000},
      values: [
        {timestamp: 0, value: null},
        {timestamp: 1000, value: 0},
        {timestamp: 2000, value: null},
        {timestamp: 3000, value: 20},
        {timestamp: 4000, value: null},
      ],
    };

    const series = new TransformedLine(timeSeries, new Set([3000])).toSeries({
      color: '#ff0099',
      unit: null,
      yAxisPosition: 'left',
    });

    expect(series[0]).toEqual(
      expect.objectContaining({
        showSymbol: true,
        data: [[0, '-'], {value: [1000, 0], symbol: 'circle'}, [2000, '-']],
      })
    );
    expect(series[1]?.data).toEqual([
      {value: [2000, '-'], symbol: 'none'},
      {value: [3000, 20], symbol: 'circle'},
      {value: [4000, '-'], symbol: 'none'},
    ]);
  });
});
