import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {transformToSeriesMap} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

function makeSeries(count: number, order?: number): EventsStats {
  return {
    data: [[1700000000, [{count}]]],
    ...(order === undefined ? {} : {order}),
    meta: {
      fields: {'count()': 'integer', 'p50(span.duration)': 'duration'},
      units: {'count()': null, 'p50(span.duration)': 'millisecond'},
      tips: {},
      isMetricsData: false,
    },
  };
}

describe('transformToSeriesMap', () => {
  it.each([
    ['is the only group', {order: makeSeries(5, 0)}],
    [
      'is one of several groups',
      {
        'project-a': makeSeries(3, 0),
        order: makeSeries(5, 1),
        'project-b': makeSeries(1, 2),
      },
    ],
  ])(
    'handles a top events group named "order" that %s',
    (_description, result: MultiSeriesEventsStats) => {
      const seriesMap = transformToSeriesMap(result, ['count()'], ['project', 'count()']);

      expect(seriesMap['count()']).toHaveLength(Object.keys(result).length);

      const orderSeries = seriesMap['count()']!.find(
        timeSeries => timeSeries.groupBy?.[0]?.value === 'order'
      );
      expect(orderSeries?.values).toEqual([
        expect.objectContaining({timestamp: 1700000000000, value: 5}),
      ]);
    }
  );

  it('handles a grouped multi-axis group named "order" among other groups', () => {
    const result: GroupedMultiSeriesEventsStats = {
      'project-a': {
        'count()': makeSeries(3),
        'p50(span.duration)': makeSeries(30),
        order: 0,
      },
      order: {
        'count()': makeSeries(5),
        'p50(span.duration)': makeSeries(50),
        order: 1,
      },
    };

    const seriesMap = transformToSeriesMap(
      result,
      ['count()', 'p50(span.duration)'],
      ['project', 'count()', 'p50(span.duration)']
    );

    expect(seriesMap['count()']).toHaveLength(2);
    expect(seriesMap['p50(span.duration)']).toHaveLength(2);
    expect(
      seriesMap['count()']!.find(timeSeries => timeSeries.groupBy?.[0]?.value === 'order')
        ?.values
    ).toEqual([expect.objectContaining({value: 5})]);
  });
});
