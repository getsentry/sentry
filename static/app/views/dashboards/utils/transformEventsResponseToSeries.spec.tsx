import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';

import {transformEventsResponseToSeries} from './transformEventsResponseToSeries';

describe('transformEventsResponseToSeries', function () {
  it('converts a single series response to an array', function () {
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

  it('converts a multi series response to an array', function () {
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

  it('converts a grouped series response to an array', function () {
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
