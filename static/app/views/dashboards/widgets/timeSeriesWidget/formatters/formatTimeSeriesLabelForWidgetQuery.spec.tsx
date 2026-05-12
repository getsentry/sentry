import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {formatTimeSeriesLabelForWidgetQuery} from './formatTimeSeriesLabelForWidgetQuery';

function makeTimeSeries(yAxis: string, groupBy?: TimeSeries['groupBy']): TimeSeries {
  return {
    yAxis,
    values: [],
    meta: {valueType: 'integer', valueUnit: null, interval: 60_000},
    ...(groupBy ? {groupBy} : {}),
  };
}

describe('formatTimeSeriesLabelForWidgetQuery', () => {
  it('uses the prettified aggregate for a single-query widget without an alias', () => {
    const widgetQuery = WidgetQueryFixture({
      name: '',
      conditions: '',
      aggregates: ['count(span.duration)'],
      columns: [],
      fields: ['count(span.duration)'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)'),
        widget,
        widgetQuery
      )
    ).toBe('count(spans)');
  });

  it('prefixes the alias when the widget query has a name', () => {
    const widgetQuery = WidgetQueryFixture({
      name: 'DB spans',
      conditions: 'span.op:db',
      aggregates: ['count(span.duration)'],
      columns: [],
      fields: ['count(span.duration)'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)'),
        widget,
        widgetQuery
      )
    ).toBe('DB spans : count(spans)');
  });

  it('falls back to the conditions when a multi-query widget has no alias', () => {
    const dbQuery = WidgetQueryFixture({
      name: '',
      conditions: 'span.op:db',
      aggregates: ['count(span.duration)'],
      columns: [],
      fields: ['count(span.duration)'],
    });
    const httpQuery = WidgetQueryFixture({
      name: '',
      conditions: 'span.op:http.client',
      aggregates: ['count(span.duration)'],
      columns: [],
      fields: ['count(span.duration)'],
    });
    const widget = WidgetFixture({queries: [dbQuery, httpQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)'),
        widget,
        dbQuery
      )
    ).toBe('span.op:db : count(spans)');
    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)'),
        widget,
        httpQuery
      )
    ).toBe('span.op:http.client : count(spans)');
  });

  it('does not prefix with conditions for a single-query widget', () => {
    const widgetQuery = WidgetQueryFixture({
      name: '',
      conditions: 'span.op:db',
      aggregates: ['count(span.duration)'],
      columns: [],
      fields: ['count(span.duration)'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)'),
        widget,
        widgetQuery
      )
    ).toBe('count(spans)');
  });

  it('uses the field alias when there are multiple aggregates and no group by', () => {
    const widgetQuery = WidgetQueryFixture({
      name: '',
      conditions: '',
      aggregates: ['count(span.duration)', 'p95(span.duration)'],
      columns: [],
      fields: ['count(span.duration)', 'p95(span.duration)'],
      fieldAliases: ['Total', 'P95'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('p95(span.duration)'),
        widget,
        widgetQuery
      )
    ).toBe('P95');
  });

  it('falls back to columns+aggregates when widget query has no fields array', () => {
    const widgetQuery = WidgetQueryFixture({
      name: '',
      conditions: '',
      aggregates: ['count(span.duration)', 'p95(span.duration)'],
      columns: [],
      fields: undefined,
      fieldAliases: ['Total', 'P95'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('p95(span.duration)'),
        widget,
        widgetQuery
      )
    ).toBe('P95');
  });

  it('uses the group-by value when the series is grouped', () => {
    const widgetQuery = WidgetQueryFixture({
      name: '',
      conditions: '',
      aggregates: ['count(span.duration)'],
      columns: ['transaction'],
      fields: ['transaction', 'count(span.duration)'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)', [{key: 'transaction', value: '/api/foo'}]),
        widget,
        widgetQuery
      )
    ).toBe('/api/foo');
  });

  it('prepends the conditions to the group-by value for a multi-query grouped widget', () => {
    const dbQuery = WidgetQueryFixture({
      name: '',
      conditions: 'span.op:db',
      aggregates: ['count(span.duration)'],
      columns: ['transaction'],
      fields: ['transaction', 'count(span.duration)'],
    });
    const httpQuery = WidgetQueryFixture({
      name: '',
      conditions: 'span.op:http.client',
      aggregates: ['count(span.duration)'],
      columns: ['transaction'],
      fields: ['transaction', 'count(span.duration)'],
    });
    const widget = WidgetFixture({queries: [dbQuery, httpQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('count(span.duration)', [{key: 'transaction', value: '/api/foo'}]),
        widget,
        dbQuery
      )
    ).toBe('span.op:db : /api/foo');
  });

  it('appends the yAxis when there are multiple aggregates and group bys', () => {
    const widgetQuery = WidgetQueryFixture({
      name: '',
      conditions: '',
      aggregates: ['count(span.duration)', 'p95(span.duration)'],
      columns: ['transaction'],
      fields: ['transaction', 'count(span.duration)', 'p95(span.duration)'],
    });
    const widget = WidgetFixture({queries: [widgetQuery]});

    expect(
      formatTimeSeriesLabelForWidgetQuery(
        makeTimeSeries('p95(span.duration)', [{key: 'transaction', value: '/api/foo'}]),
        widget,
        widgetQuery
      )
    ).toBe('/api/foo : p95(span.duration)');
  });
});
