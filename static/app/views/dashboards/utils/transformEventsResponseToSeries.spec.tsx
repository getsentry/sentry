import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';

import {transformEventsResponseToSeries} from './transformEventsResponseToSeries';

describe('transformEventsResponseToSeries', () => {
  it('converts a single series response to an array', () => {
    const rawData: EventsStats = {
      data: [
        [1737731713, [{count: 17}]],
        [1737731773, [{count: 22}, {count: 1}]],
      ],
    };

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
    });

    expect(transformEventsResponseToSeries(rawData, widgetQuery)).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 23,
          },
        ],
        seriesName: 'count()',
      },
    ]);
  });

  it('converts a multi series response to an array', () => {
    const rawData: MultiSeriesEventsStats = {
      'count()': {
        data: [
          [1737731713, [{count: 17}]],
          [1737731773, [{count: 22}]],
        ],
        order: 1,
      },
      'avg(transaction.duration)': {
        data: [
          [1737731713, [{count: 12.4}]],
          [1737731773, [{count: 17.7}, {count: 1.0}]],
        ],
        order: 0,
      },
    };

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()', 'avg(transaction.duration)'],
      aggregates: ['count()', 'avg(transaction.duration)'],
      columns: [],
    });

    expect(transformEventsResponseToSeries(rawData, widgetQuery)).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 12.4,
          },
          {
            name: 1737731773000,
            value: 18.7,
          },
        ],
        seriesName: 'avg(transaction.duration)',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 22,
          },
        ],
        seriesName: 'count()',
      },
    ]);
  });

  it('filters out order metadata key from multi series response', () => {
    // Test case for JAVASCRIPT-37ZS
    // MultiSeriesEventsStats can have a top-level 'order' key that should be filtered
    const rawData = {
      'count()': {
        data: [
          [1737731713, [{count: 17}]],
          [1737731773, [{count: 22}]],
        ],
        order: 1,
      },
      'avg(transaction.duration)': {
        data: [
          [1737731713, [{count: 12.4}]],
          [1737731773, [{count: 17.7}]],
        ],
        order: 0,
      },
      order: 999, // This top-level metadata key should be filtered out
    } as MultiSeriesEventsStats;

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()', 'avg(transaction.duration)'],
      aggregates: ['count()', 'avg(transaction.duration)'],
      columns: [],
    });

    const result = transformEventsResponseToSeries(rawData, widgetQuery);

    // Should only have 2 series, not 3 (order should be filtered out)
    expect(result).toHaveLength(2);

    // Should not include any series named 'order'
    expect(result.every(series => series.seriesName !== 'order')).toBe(true);

    // Verify the actual series are correctly transformed
    expect(result).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 12.4,
          },
          {
            name: 1737731773000,
            value: 17.7,
          },
        ],
        seriesName: 'avg(transaction.duration)',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 22,
          },
        ],
        seriesName: 'count()',
      },
    ]);
  });

  it('converts a grouped series response to an array', () => {
    const rawData: GroupedMultiSeriesEventsStats = {
      prod: {
        'count()': {
          data: [
            [1737731713, [{count: 170}]],
            [1737731773, [{count: 220}]],
          ],
        },
        'avg(transaction.duration)': {
          data: [
            [1737731713, [{count: 124}]],
            [1737731773, [{count: 177}, {count: 10}]],
          ],
        },
        order: 1,
      },
      dev: {
        'count()': {
          data: [
            [1737731713, [{count: 17}]],
            [1737731773, [{count: 22}]],
          ],
        },
        'avg(transaction.duration)': {
          data: [
            [1737731713, [{count: 12.4}]],
            [1737731773, [{count: 17.7}, {count: 1.0}]],
          ],
        },
        order: 0,
      },
    };

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()', 'avg(transaction.duration)'],
      aggregates: ['count()', 'avg(transaction.duration)'],
      columns: ['env'],
    });

    expect(transformEventsResponseToSeries(rawData, widgetQuery)).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 22,
          },
        ],
        seriesName: 'dev : count()',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 12.4,
          },
          {
            name: 1737731773000,
            value: 18.7,
          },
        ],
        seriesName: 'dev : avg(transaction.duration)',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 170,
          },
          {
            name: 1737731773000,
            value: 220,
          },
        ],
        seriesName: 'prod : count()',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 124,
          },
          {
            name: 1737731773000,
            value: 187,
          },
        ],
        seriesName: 'prod : avg(transaction.duration)',
      },
    ]);
  });
});
