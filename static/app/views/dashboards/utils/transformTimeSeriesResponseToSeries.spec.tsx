import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {transformTimeSeriesResponseToSeries} from './transformTimeSeriesResponseToSeries';

function makeTimeSeries(
  yAxis: string,
  {
    groupBy,
    order,
    isOther,
  }: Partial<TimeSeries['meta']> & Pick<TimeSeries, 'groupBy'> = {}
): TimeSeries {
  return TimeSeriesFixture({
    yAxis,
    groupBy,
    meta: {valueType: 'integer', valueUnit: null, interval: 60_000, order, isOther},
    values: [
      {timestamp: 1000, value: 1},
      {timestamp: 2000, value: 3, incomplete: true},
    ],
  });
}

const chrome = [{key: 'browser', value: 'Chrome'}];

describe('transformTimeSeriesResponseToSeries', () => {
  it.each([
    {
      name: 'single y-axis',
      alias: '',
      columns: [],
      timeSeries: [makeTimeSeries('count()')],
      expected: ['count()'],
    },
    {
      name: 'multiple y-axes with an alias',
      alias: 'Alias',
      columns: [],
      timeSeries: [makeTimeSeries('count()'), makeTimeSeries('p50(span.duration)')],
      expected: ['Alias : count()', 'Alias : p50(span.duration)'],
    },
    {
      name: 'groups with a single y-axis, sorted by order',
      alias: '',
      timeSeries: [
        makeTimeSeries('count()', {isOther: true, order: 2}),
        makeTimeSeries('count()', {
          groupBy: [
            {key: 'error.type', value: ['TypeError', null]},
            {key: 'os', value: null},
          ],
          order: 1,
        }),
        makeTimeSeries('count()', {groupBy: chrome, order: 0}),
      ],
      expected: ['Chrome', '[TypeError,(no value)],None', 'Other'],
    },
    {
      name: 'groups with multiple y-axes and an alias',
      alias: 'Alias',
      timeSeries: [
        makeTimeSeries('count()', {groupBy: chrome}),
        makeTimeSeries('p50(span.duration)', {groupBy: chrome}),
      ],
      expected: ['Alias > Chrome : count()', 'Alias > Chrome : p50(span.duration)'],
    },
    {
      name: 'a group with no matching buckets',
      alias: 'Alias',
      timeSeries: [
        makeTimeSeries('count()', {groupBy: chrome, order: 0}),
        makeTimeSeries('count()', {groupBy: null, order: 1}),
      ],
      expected: ['Alias : Chrome', 'Alias : '],
    },
  ])(
    'matches events-stats series names for $name',
    ({alias, columns, timeSeries, expected}) => {
      const result = transformTimeSeriesResponseToSeries(
        {timeSeries},
        WidgetQueryFixture({name: alias, ...(columns ? {columns} : {})})
      );

      expect(result.map(({seriesName}) => seriesName)).toEqual(expected);
    }
  );

  it('keeps the original time series and converts its values to series data', () => {
    const timeSeries = makeTimeSeries('count()');
    const [series] = transformTimeSeriesResponseToSeries(
      {timeSeries: [timeSeries]},
      WidgetQueryFixture({name: ''})
    );

    expect(series!.timeSeries).toBe(timeSeries);
    expect(series!.data).toEqual([
      {name: 1000, value: 1},
      {name: 2000, value: 3},
    ]);
  });
});
