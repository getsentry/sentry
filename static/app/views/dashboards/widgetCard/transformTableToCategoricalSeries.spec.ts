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
        units: {},
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

    // Cast to any to test edge cases - APIs can return null even though TS types don't allow it
    const tableData = {
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
    } as TableDataWithTitle;

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

  it('limits categories to 10 and aggregates the rest into "Other"', () => {
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

    // Create 15 browsers with descending counts
    const tableData: TableDataWithTitle = {
      title: 'Test Query',
      data: [
        {id: '1', browser: 'Chrome', 'count()': 1500},
        {id: '2', browser: 'Firefox', 'count()': 1400},
        {id: '3', browser: 'Safari', 'count()': 1300},
        {id: '4', browser: 'Edge', 'count()': 1200},
        {id: '5', browser: 'Opera', 'count()': 1100},
        {id: '6', browser: 'Brave', 'count()': 1000},
        {id: '7', browser: 'Vivaldi', 'count()': 900},
        {id: '8', browser: 'Arc', 'count()': 800},
        {id: '9', browser: 'Chromium', 'count()': 700},
        {id: '10', browser: 'Tor', 'count()': 600},
        {id: '11', browser: 'Pale Moon', 'count()': 500},
        {id: '12', browser: 'Waterfox', 'count()': 400},
        {id: '13', browser: 'SeaMonkey', 'count()': 300},
        {id: '14', browser: 'Lynx', 'count()': 200},
        {id: '15', browser: 'Links', 'count()': 100},
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

    // Should have 10 items: top 9 browsers + "Other"
    expect(result[0]!.values).toHaveLength(10);

    // Top 9 should be the highest values (sorted by value descending)
    expect(result[0]!.values.slice(0, 9)).toEqual([
      {category: 'Chrome', value: 1500},
      {category: 'Firefox', value: 1400},
      {category: 'Safari', value: 1300},
      {category: 'Edge', value: 1200},
      {category: 'Opera', value: 1100},
      {category: 'Brave', value: 1000},
      {category: 'Vivaldi', value: 900},
      {category: 'Arc', value: 800},
      {category: 'Chromium', value: 700},
    ]);

    // Last item should be "Other" with sum of remaining values
    // Tor(600) + Pale Moon(500) + Waterfox(400) + SeaMonkey(300) + Lynx(200) + Links(100) = 2100
    expect(result[0]!.values[9]).toEqual({
      category: 'Other',
      value: 2100,
    });
  });

  it('does not add "Other" when categories are at or below limit', () => {
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

    // Exactly 10 browsers - should not add "Other"
    const tableData: TableDataWithTitle = {
      title: 'Test Query',
      data: [
        {id: '1', browser: 'Chrome', 'count()': 1000},
        {id: '2', browser: 'Firefox', 'count()': 900},
        {id: '3', browser: 'Safari', 'count()': 800},
        {id: '4', browser: 'Edge', 'count()': 700},
        {id: '5', browser: 'Opera', 'count()': 600},
        {id: '6', browser: 'Brave', 'count()': 500},
        {id: '7', browser: 'Vivaldi', 'count()': 400},
        {id: '8', browser: 'Arc', 'count()': 300},
        {id: '9', browser: 'Chromium', 'count()': 200},
        {id: '10', browser: 'Tor', 'count()': 100},
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
    expect(result[0]!.values).toHaveLength(10);

    // Should not have "Other" category
    expect(result[0]!.values.find(v => v.category === 'Other')).toBeUndefined();
  });
});
