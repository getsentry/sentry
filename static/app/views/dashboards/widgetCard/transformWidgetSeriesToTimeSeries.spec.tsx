import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {Series} from 'sentry/types/echarts';

import {transformWidgetSeriesToTimeSeries} from './transformWidgetSeriesToTimeSeries';

function makeSeries(seriesName: string, data: number[] = [1, 2, 3]): Series {
  return {
    seriesName,
    data: data.map((value, i) => ({name: `2024-01-0${i + 1}`, value})),
  };
}

describe('transformWidgetSeriesToTimeSeries', () => {
  it('returns null when widget has no queries', () => {
    const widget = WidgetFixture({queries: []});
    const result = transformWidgetSeriesToTimeSeries(makeSeries('count()'), widget);
    expect(result).toBeNull();
  });

  it('produces a label with the aggregate for a single-query, single-aggregate widget', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          name: '',
          aggregates: ['count()'],
          columns: [],
          fields: ['count()'],
        }),
      ],
    });

    const result = transformWidgetSeriesToTimeSeries(makeSeries('count()'), widget);
    expect(result?.label).toBe('count()');
  });

  describe('multi-query labels (prefixed upstream with > delimiter)', () => {
    it('extracts conditions prefix from before the > delimiter', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: '',
            conditions: 'browser:Chrome',
            aggregates: ['count()'],
            columns: [],
            fields: ['count()'],
          }),
          WidgetQueryFixture({
            name: '',
            conditions: 'browser:Firefox',
            aggregates: ['count()'],
            columns: [],
            fields: ['count()'],
          }),
        ],
      });

      // Hooks prefix with ' > ' via getSeriesQueryPrefix
      const result0 = transformWidgetSeriesToTimeSeries(
        makeSeries('browser:Chrome > count()'),
        widget
      );
      expect(result0?.label).toBe('browser:Chrome : count()');

      const result1 = transformWidgetSeriesToTimeSeries(
        makeSeries('browser:Firefox > count()'),
        widget
      );
      expect(result1?.label).toBe('browser:Firefox : count()');
    });

    it('extracts conditions prefix with group-by values', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: '',
            conditions: 'browser:Chrome',
            aggregates: ['count()'],
            columns: ['environment'],
            fields: ['environment', 'count()'],
          }),
          WidgetQueryFixture({
            name: '',
            conditions: 'browser:Firefox',
            aggregates: ['count()'],
            columns: ['environment'],
            fields: ['environment', 'count()'],
          }),
        ],
      });

      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('browser:Chrome > prod : count()'),
        widget
      );
      expect(result?.label).toBe('browser:Chrome : prod');
    });

    it('uses query alias from the : delimited series name when available', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: 'Chrome',
            conditions: 'browser:Chrome',
            aggregates: ['count()'],
            columns: [],
            fields: ['count()'],
          }),
          WidgetQueryFixture({
            name: 'Firefox',
            conditions: 'browser:Firefox',
            aggregates: ['count()'],
            columns: [],
            fields: ['count()'],
          }),
        ],
      });

      // Alias without group-by uses ' : ' (from transformEventsResponseToSeries)
      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('Chrome : count()'),
        widget
      );
      expect(result?.label).toBe('Chrome : count()');
      expect(result?.widgetQuery.name).toBe('Chrome');
    });
  });

  describe('multi-query with group by but no conditions', () => {
    it('does not misidentify group-by values as query names', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: '',
            conditions: '',
            aggregates: ['count()'],
            columns: ['environment'],
            fields: ['environment', 'count()'],
          }),
          WidgetQueryFixture({
            name: '',
            conditions: '',
            aggregates: ['count()'],
            columns: ['environment'],
            fields: ['environment', 'count()'],
          }),
        ],
      });

      // No ' > ' delimiter — "prod" is a group-by value, not a query prefix
      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('prod : count()'),
        widget
      );
      expect(result?.label).toBe('prod');
    });
  });

  describe('multi-aggregate, single query, with group by', () => {
    it('appends yAxis for uniqueness when there are multiple aggregates and group by columns', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: '',
            aggregates: ['count()', 'avg(duration)'],
            columns: ['environment'],
            fields: ['environment', 'count()', 'avg(duration)'],
          }),
        ],
      });

      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('prod : count()'),
        widget
      );
      expect(result?.label).toBe('prod : count()');
    });

    it('does not duplicate aggregate info with single aggregate and group by', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: '',
            aggregates: ['count()'],
            columns: ['environment'],
            fields: ['environment', 'count()'],
          }),
        ],
      });

      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('prod : count()'),
        widget
      );
      expect(result?.label).toBe('prod');
    });
  });
});
