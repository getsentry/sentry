import {WidgetFixture} from 'sentry-fixture/widget';

import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {transformTableToCategoricalSeries} from './transformTableToCategoricalSeries';

describe('transformTableToCategoricalSeries', () => {
  it('transforms table data to categorical series format', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.SPANS,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser', 'count()'],
          columns: ['browser'],
          aggregates: ['count()'],
          orderby: '-count()',
        },
      ],
    });

    const tableData: TableDataWithTitle = {
      title: 'Test Query',
      data: [
        {id: '1', browser: 'Chrome', 'count()': 1250},
        {id: '2', browser: 'Firefox', 'count()': 890},
        {id: '3', browser: 'Safari', 'count()': 650},
      ],
      meta: {
        fields: {
          browser: 'string',
          'count()': 'integer',
        },
        units: {
          browser: null,
          'count()': null,
        },
      },
    };

    const result = transformTableToCategoricalSeries({
      widget,
      tableData,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      valueAxis: 'count()',
      meta: {
        valueType: 'integer',
        valueUnit: null,
      },
      values: [
        {category: 'Chrome', value: 1250},
        {category: 'Firefox', value: 890},
        {category: 'Safari', value: 650},
      ],
    });
  });

  it('handles multiple aggregates (creates multiple series)', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.SPANS,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser', 'count()', 'avg(span.duration)'],
          columns: ['browser'],
          aggregates: ['count()', 'avg(span.duration)'],
          orderby: '-count()',
        },
      ],
    });

    const tableData: TableDataWithTitle = {
      title: 'Test Query',
      data: [
        {id: '1', browser: 'Chrome', 'count()': 1250, 'avg(span.duration)': 150.5},
        {id: '2', browser: 'Firefox', 'count()': 890, 'avg(span.duration)': 200.3},
      ],
      meta: {
        fields: {
          browser: 'string',
          'count()': 'integer',
          'avg(span.duration)': 'duration',
        },
        units: {
          browser: null,
          'count()': null,
          'avg(span.duration)': 'millisecond',
        },
      },
    };

    const result = transformTableToCategoricalSeries({
      widget,
      tableData,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      valueAxis: 'count()',
      meta: {
        valueType: 'integer',
        valueUnit: null,
      },
      values: [
        {category: 'Chrome', value: 1250},
        {category: 'Firefox', value: 890},
      ],
    });
    expect(result[1]).toEqual({
      valueAxis: 'avg(span.duration)',
      meta: {
        valueType: 'duration',
        valueUnit: 'millisecond',
      },
      values: [
        {category: 'Chrome', value: 150.5},
        {category: 'Firefox', value: 200.3},
      ],
    });
  });

  it('handles null and non-numeric values', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.SPANS,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser', 'count()'],
          columns: ['browser'],
          aggregates: ['count()'],
          orderby: '-count()',
        },
      ],
    });

    const tableData: TableDataWithTitle = {
      title: 'Test Query',
      data: [
        {id: '1', browser: 'Chrome', 'count()': 100},
        {id: '2', browser: null, 'count()': 50},
        {id: '3', browser: 'Safari', 'count()': 'invalid'},
      ],
      meta: {
        fields: {
          browser: 'string',
          'count()': 'integer',
        },
        units: {},
      },
    };

    const result = transformTableToCategoricalSeries({
      widget,
      tableData,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.values).toEqual([
      {category: 'Chrome', value: 100},
      {category: '', value: 50}, // null becomes empty string
      {category: 'Safari', value: null}, // non-numeric becomes null
    ]);
  });

  it('returns empty array when no columns defined', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count()'],
          columns: [],
          aggregates: ['count()'],
          orderby: '',
        },
      ],
    });

    const tableData: TableDataWithTitle = {
      title: 'Test',
      data: [{id: '1', 'count()': 100}],
    };

    const result = transformTableToCategoricalSeries({
      widget,
      tableData,
    });

    expect(result).toEqual([]);
  });

  it('returns empty array when no aggregates defined', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser'],
          columns: ['browser'],
          aggregates: [],
          orderby: '',
        },
      ],
    });

    const tableData: TableDataWithTitle = {
      title: 'Test',
      data: [{id: '1', browser: 'Chrome'}],
    };

    const result = transformTableToCategoricalSeries({
      widget,
      tableData,
    });

    expect(result).toEqual([]);
  });

  it('defaults to "number" for unknown value types', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser', 'count()'],
          columns: ['browser'],
          aggregates: ['count()'],
          orderby: '',
        },
      ],
    });

    const tableData: TableDataWithTitle = {
      title: 'Test',
      data: [{id: '1', browser: 'Chrome', 'count()': 100}],
      meta: {
        fields: {
          browser: 'string',
          'count()': 'unknown_type', // Unknown type
        },
        units: {},
      },
    };

    const result = transformTableToCategoricalSeries({
      widget,
      tableData,
    });

    expect(result[0]!.meta.valueType).toBe('number');
  });
});
