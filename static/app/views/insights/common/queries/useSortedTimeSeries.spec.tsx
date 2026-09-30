import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {transformToSeriesMap} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

describe('transformToSeriesMap', () => {
  it('handles a top events response whose only group is named "order"', () => {
    const result: MultiSeriesEventsStats = {
      order: {
        data: [[1700000000, [{count: 5}]]],
        order: 0,
        meta: {
          fields: {'count()': 'integer'},
          units: {'count()': null},
          tips: {},
          isMetricsData: false,
        },
      },
    };

    const seriesMap = transformToSeriesMap(result, ['count()'], ['project', 'count()']);

    expect(seriesMap['count()']).toHaveLength(1);
    expect(seriesMap['count()']![0]!.groupBy).toEqual([{key: 'project', value: 'order'}]);
    expect(seriesMap['count()']![0]!.values).toEqual([
      expect.objectContaining({timestamp: 1700000000000, value: 5}),
    ]);
  });
});
