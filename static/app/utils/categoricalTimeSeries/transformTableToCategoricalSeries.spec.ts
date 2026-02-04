import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';

import {transformTableToCategoricalSeries} from './transformTableToCategoricalSeries';

describe('transformTableToCategoricalSeries', () => {
  it('transforms table data to categorical series format', () => {
    const query = WidgetQueryFixture({
      fields: ['browser', 'count()'],
      columns: ['browser'],
      aggregates: ['count()'],
      orderby: '-count()',
    });

    const tableData: TabularData = {
      data: [
        {browser: 'Chrome', 'count()': 1250},
        {browser: 'Firefox', 'count()': 890},
        {browser: 'Safari', 'count()': 650},
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
      query,
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
    const query = WidgetQueryFixture({
      fields: ['browser', 'count()', 'avg(span.duration)'],
      columns: ['browser'],
      aggregates: ['count()', 'avg(span.duration)'],
      orderby: '-count()',
    });

    const tableData: TabularData = {
      data: [
        {browser: 'Chrome', 'count()': 1250, 'avg(span.duration)': 150.5},
        {browser: 'Firefox', 'count()': 890, 'avg(span.duration)': 200.3},
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
          'avg(span.duration)': DurationUnit.MILLISECOND,
        },
      },
    };

    const result = transformTableToCategoricalSeries({
      query,
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
        valueUnit: DurationUnit.MILLISECOND,
      },
      values: [
        {category: 'Chrome', value: 150.5},
        {category: 'Firefox', value: 200.3},
      ],
    });
  });

  it('handles null and non-numeric values', () => {
    const query = WidgetQueryFixture({
      fields: ['browser', 'count()'],
      columns: ['browser'],
      aggregates: ['count()'],
      orderby: '-count()',
    });

    const tableData: TabularData = {
      data: [
        {browser: 'Chrome', 'count()': 100},
        {browser: null, 'count()': 50},
        {browser: 'Safari', 'count()': 'invalid'},
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
      query,
      tableData,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.values).toEqual([
      {category: 'Chrome', value: 100},
      {category: '(empty)', value: 50}, // null/empty becomes "(empty)" label
      {category: 'Safari', value: null}, // non-numeric becomes null
    ]);
  });

  it('returns empty array when no columns defined', () => {
    const query = WidgetQueryFixture({
      fields: ['count()'],
      columns: [],
      aggregates: ['count()'],
    });

    const tableData: TabularData = {
      data: [{'count()': 100}],
      meta: {
        fields: {'count()': 'integer'},
        units: {'count()': null},
      },
    };

    const result = transformTableToCategoricalSeries({
      query,
      tableData,
    });

    expect(result).toEqual([]);
  });

  it('returns empty array when no aggregates defined', () => {
    const query = WidgetQueryFixture({
      fields: ['browser'],
      columns: ['browser'],
      aggregates: [],
    });

    const tableData: TabularData = {
      data: [{browser: 'Chrome'}],
      meta: {
        fields: {browser: 'string'},
        units: {browser: null},
      },
    };

    const result = transformTableToCategoricalSeries({
      query,
      tableData,
    });

    expect(result).toEqual([]);
  });

  it('defaults to "number" for unknown value types', () => {
    const query = WidgetQueryFixture({
      fields: ['browser', 'count()'],
      columns: ['browser'],
      aggregates: ['count()'],
    });

    // Cast to test edge case - APIs can return unexpected types
    const tableData = {
      data: [{browser: 'Chrome', 'count()': 100}],
      meta: {
        fields: {
          browser: 'string',
          'count()': 'unknown_type',
        },
        units: {
          browser: null,
          'count()': null,
        },
      },
    } as unknown as TabularData;

    const result = transformTableToCategoricalSeries({
      query,
      tableData,
    });

    expect(result[0]!.meta.valueType).toBe('number');
  });
});
