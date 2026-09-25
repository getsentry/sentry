import * as isEventsStatsModule from 'sentry/views/dashboards/utils/isEventsStats';
import {transformToSeriesMap} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

describe('transformToSeriesMap', () => {
  describe('isGroupedMultiSeriesEventsStats branch', () => {
    it('returns correct series for a valid grouped multi-series response', () => {
      const result = {
        'project-a': {
          order: 0,
          'count()': {
            data: [[1700000000, [{count: 5}]]] as any,
            meta: {
              fields: {'count()': 'integer'},
              units: {'count()': null},
              tips: {},
              isMetricsData: false,
            },
          },
        },
        'project-b': {
          order: 1,
          'count()': {
            data: [[1700000000, [{count: 3}]]] as any,
            meta: {
              fields: {'count()': 'integer'},
              units: {'count()': null},
              tips: {},
              isMetricsData: false,
            },
          },
        },
      };

      expect(() => transformToSeriesMap(result as any, ['count()'])).not.toThrow();
      const seriesMap = transformToSeriesMap(result as any, ['count()']);
      expect(seriesMap['count()']).toHaveLength(2);
    });

    it('does not crash when a groupData key (besides order) lacks a .data array', () => {
      // Force the isGroupedMultiSeriesEventsStats branch to be entered so we can
      // verify the defensive guard added in the iteration loop.
      jest
        .spyOn(isEventsStatsModule, 'isGroupedMultiSeriesEventsStats')
        .mockReturnValue(true);

      // This simulates an unexpected API response shape where an inner key has no
      // .data array — before the fix this would throw "Cannot read properties of
      // undefined (reading 'map')".
      const result = {
        'project-a': {
          order: 0,
          'count()': {
            data: [[1700000000, [{count: 5}]]] as any,
            meta: {
              fields: {'count()': 'integer'},
              units: {'count()': null},
              tips: {},
              isMetricsData: false,
            },
          },
          // A key whose value lacks .data — would crash without the guard
          badKey: {noDataHere: true} as any,
        },
      };

      expect(() => transformToSeriesMap(result as any, ['count()'])).not.toThrow();

      // The valid axis should still be present in the output
      const seriesMap = transformToSeriesMap(result as any, ['count()']);
      expect(seriesMap['count()']).toBeDefined();
      expect(seriesMap['count()']).toHaveLength(1);

      jest.restoreAllMocks();
    });
  });
});
