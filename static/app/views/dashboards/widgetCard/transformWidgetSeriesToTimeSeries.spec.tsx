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

  describe('Case 1: multi-query labels (prefixed upstream by labelSeriesForLegend)', () => {
    it('uses the conditions prefix from the series name as the query label', () => {
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

      // Series names are pre-prefixed by labelSeriesForLegend in the hooks
      const result0 = transformWidgetSeriesToTimeSeries(
        makeSeries('browser:Chrome : count()'),
        widget
      );
      expect(result0?.label).toBe('browser:Chrome : count()');
      expect(result0?.widgetQuery.conditions).toBe('browser:Chrome');

      const result1 = transformWidgetSeriesToTimeSeries(
        makeSeries('browser:Firefox : count()'),
        widget
      );
      expect(result1?.label).toBe('browser:Firefox : count()');
      expect(result1?.widgetQuery.conditions).toBe('browser:Firefox');
    });

    it('uses query alias from the series name when available', () => {
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

      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('Chrome : count()'),
        widget
      );
      expect(result?.label).toBe('Chrome : count()');
      expect(result?.widgetQuery.name).toBe('Chrome');
    });

    it('handles multi-aggregate multi-query with conditions prefix', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({
            name: '',
            conditions: 'browser:Chrome',
            aggregates: ['count()', 'avg(duration)'],
            columns: [],
            fields: ['count()', 'avg(duration)'],
          }),
          WidgetQueryFixture({
            name: '',
            conditions: 'browser:Firefox',
            aggregates: ['count()', 'avg(duration)'],
            columns: [],
            fields: ['count()', 'avg(duration)'],
          }),
        ],
      });

      const result = transformWidgetSeriesToTimeSeries(
        makeSeries('browser:Firefox : count()'),
        widget
      );
      expect(result?.label).toBe('browser:Firefox : count()');
      expect(result?.widgetQuery.conditions).toBe('browser:Firefox');
    });
  });

  describe('Case 2: multi-aggregate, single query, with group by', () => {
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
