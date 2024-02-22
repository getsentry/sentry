import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';
import {MetricQueryType} from 'sentry/utils/metrics/types';
import {parseMetricWidgetsQueryParam} from 'sentry/views/ddm/utils/parseMetricWidgetsQueryParam';

describe('parseMetricWidgetQueryParam', () => {
  it('returns single default widget for invalid param', () => {
    const defaultState = [emptyMetricsQueryWidget];
    expect(parseMetricWidgetsQueryParam(undefined)).toBe(defaultState);
    expect(parseMetricWidgetsQueryParam('')).toBe(defaultState);
    expect(parseMetricWidgetsQueryParam('{}')).toBe(defaultState);
    expect(parseMetricWidgetsQueryParam('true')).toBe(defaultState);
    expect(parseMetricWidgetsQueryParam('2')).toBe(defaultState);
    expect(parseMetricWidgetsQueryParam('"test"')).toBe(defaultState);

    // empty array is not valid
    expect(parseMetricWidgetsQueryParam('[]')).toEqual(defaultState);
  });

  it('returns a single widget', () => {
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            id: 0,
            type: MetricQueryType.QUERY,
            mri: 'd:transactions/duration@millisecond',
            op: 'sum',
            query: 'test:query',
            groupBy: ['dist'],
            displayType: 'line',
            focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
            powerUserMode: true,
            sort: {order: 'asc'},
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'sum',
        query: 'test:query',
        groupBy: ['dist'],
        displayType: 'line',
        focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
        powerUserMode: true,
        sort: {name: undefined, order: 'asc'},
      },
    ]);
  });

  it('returns multiple widgets', () => {
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            id: 0,
            type: MetricQueryType.QUERY,
            mri: 'd:transactions/duration@millisecond',
            op: 'sum',
            query: 'test:query',
            groupBy: ['dist'],
            displayType: 'line',
            focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
            powerUserMode: true,
            sort: {name: 'avg', order: 'desc'},
          },
          {
            id: 1,
            type: MetricQueryType.QUERY,
            mri: 'd:custom/sentry.event_manager.save@second',
            op: 'avg',
            query: '',
            groupBy: ['event_type'],
            displayType: 'line',
            powerUserMode: false,
            focusedSeries: [{seriesName: 'default', groupBy: {event_type: 'default'}}],
            sort: {name: 'sum', order: 'asc'},
          },
          {
            id: 2,
            type: MetricQueryType.FORMULA,
            formula: 'a + b',
            displayType: 'line',
            sort: {name: 'avg', order: 'desc'},
            focusedSeries: [],
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'sum',
        query: 'test:query',
        groupBy: ['dist'],
        displayType: 'line',
        focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
        powerUserMode: true,
        sort: {name: 'avg', order: 'desc'},
      },
      {
        id: 1,
        type: MetricQueryType.QUERY,
        mri: 'd:custom/sentry.event_manager.save@second',
        op: 'avg',
        query: '',
        groupBy: ['event_type'],
        displayType: 'line',
        powerUserMode: false,
        focusedSeries: [{seriesName: 'default', groupBy: {event_type: 'default'}}],
        sort: {name: 'sum', order: 'asc'},
      },
      {
        id: 2,
        type: MetricQueryType.FORMULA,
        formula: 'a + b',
        displayType: 'line',
        sort: {name: 'avg', order: 'desc'},
        focusedSeries: [],
      },
    ]);
  });

  it('falls back to defaults', () => {
    // Missing values
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            mri: 'd:transactions/duration@millisecond',
          },
          {
            type: MetricQueryType.FORMULA,
            formula: 'a * 2',
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'avg',
        query: '',
        groupBy: [],
        displayType: 'line',
        focusedSeries: [],
        powerUserMode: false,
        sort: {name: undefined, order: 'asc'},
      },
      {
        id: 1,
        type: MetricQueryType.FORMULA,
        formula: 'a * 2',
        displayType: 'line',
        focusedSeries: [],
        sort: {name: undefined, order: 'asc'},
      },
    ]);

    // Invalid values
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            id: 'invalid',
            type: 123,
            mri: 'd:transactions/duration@millisecond',
            op: 1,
            query: 12,
            groupBy: true,
            displayType: 'aasfcsdf',
            focusedSeries: {},
            powerUserMode: 1,
            sort: {name: 1, order: 'invalid'},
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'avg',
        query: '',
        groupBy: [],
        displayType: 'line',
        focusedSeries: [],
        powerUserMode: false,
        sort: {name: undefined, order: 'asc'},
      },
    ]);
  });

  it('ignores invalid widgets', () => {
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            id: 0,
            mri: 'd:transactions/duration@millisecond',
          },
          {
            // Missing MRI
          },
          {
            // Mallformed MRI
            mri: 'transactions/duration@millisecond',
          },
          {
            // Duplicate id
            id: 0,
            mri: 'd:transactions/duration@second',
          },
          {
            // Missing formula
            type: MetricQueryType.FORMULA,
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'avg',
        query: '',
        groupBy: [],
        displayType: 'line',
        focusedSeries: [],
        powerUserMode: false,
        sort: {order: 'asc'},
      },
    ]);
  });

  it('returns undefined if there is no valid widget', () => {
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            // Missing MRI
          },
          {
            // Missing formula
            type: MetricQueryType.FORMULA,
          },
        ])
      )
    ).toBe(undefined);
  });

  it('handles missing array in array params', () => {
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            id: 0,
            type: MetricQueryType.QUERY,
            mri: 'd:transactions/duration@millisecond',
            op: 'sum',
            query: 'test:query',
            groupBy: 'dist',
            displayType: 'line',
            focusedSeries: {seriesName: 'default', groupBy: {dist: 'default'}},
            powerUserMode: true,
            sort: {order: 'asc'},
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'sum',
        query: 'test:query',
        groupBy: ['dist'],
        displayType: 'line',
        focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
        powerUserMode: true,
        sort: {name: undefined, order: 'asc'},
      },
    ]);
  });

  it('adds missing ids', () => {
    const widgetWithId = (id: number | undefined) => ({
      id,
      type: MetricQueryType.QUERY,
      mri: 'd:transactions/duration@millisecond',
      op: 'sum',
      query: 'test:query',
      groupBy: ['dist'],
      displayType: 'line',
      focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
      powerUserMode: true,
      sort: {name: 'avg', order: 'desc'},
    });
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          widgetWithId(0),
          widgetWithId(undefined),
          widgetWithId(2),
          {
            // Invalid widget
          },
          widgetWithId(undefined),
          widgetWithId(3),
        ])
      )
    ).toEqual([
      widgetWithId(0),
      widgetWithId(1),
      widgetWithId(2),
      widgetWithId(4),
      widgetWithId(3),
    ]);
  });

  it('resets the id of a single widget to 0', () => {
    expect(
      parseMetricWidgetsQueryParam(
        JSON.stringify([
          {
            id: 5,
            type: MetricQueryType.QUERY,
            mri: 'd:transactions/duration@millisecond',
            op: 'sum',
            query: 'test:query',
            groupBy: ['dist'],
            displayType: 'line',
            focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
            powerUserMode: true,
            sort: {name: 'avg', order: 'desc'},
          },
        ])
      )
    ).toEqual([
      {
        id: 0,
        type: MetricQueryType.QUERY,
        mri: 'd:transactions/duration@millisecond',
        op: 'sum',
        query: 'test:query',
        groupBy: ['dist'],
        displayType: 'line',
        focusedSeries: [{seriesName: 'default', groupBy: {dist: 'default'}}],
        powerUserMode: true,
        sort: {name: 'avg', order: 'desc'},
      },
    ]);
  });
});
