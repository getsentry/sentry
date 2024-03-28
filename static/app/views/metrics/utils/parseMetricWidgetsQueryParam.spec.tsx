import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';
import {
  MetricDisplayType,
  MetricExpressionType,
  type MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import {parseMetricWidgetsQueryParam} from 'sentry/views/metrics/utils/parseMetricWidgetsQueryParam';

function testParsing(input: any, result: MetricWidgetQueryParams[]) {
  expect(parseMetricWidgetsQueryParam(JSON.stringify(input))).toStrictEqual(result);
}

describe('parseMetricWidgetQueryParam', () => {
  const defaultState = [{...emptyMetricsQueryWidget, id: 0}];
  it('returns default widget for invalid param', () => {
    testParsing(undefined, defaultState);
    testParsing({}, defaultState);
    testParsing(true, defaultState);
    testParsing(2, defaultState);
    testParsing('', defaultState);
    testParsing('test', defaultState);

    // empty array is not valid
    testParsing([], defaultState);
  });

  it('returns a single widget', () => {
    testParsing(
      [
        // INPUT
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: 'line',
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {order: 'asc'},
          isHidden: true,
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: undefined, order: 'asc'},
          isHidden: true,
        },
      ]
    );
  });

  it('returns multiple widgets', () => {
    testParsing(
      // INPUT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: 'line',
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: true,
        },
        {
          id: 0,
          type: MetricExpressionType.EQUATION,
          formula: 'a + b',
          displayType: 'line',
          sort: {name: 'avg', order: 'desc'},
          focusedSeries: [],
          isHidden: true,
        },
        {
          id: 1,
          type: MetricExpressionType.QUERY,
          mri: 'd:custom/sentry.event_manager.save@second',
          op: 'avg',
          query: '',
          groupBy: ['event_type'],
          displayType: 'line',
          powerUserMode: false,
          focusedSeries: [{id: 'default', groupBy: {event_type: 'default'}}],
          sort: {name: 'sum', order: 'asc'},
          isHidden: false,
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: true,
        },
        {
          id: 1,
          type: MetricExpressionType.QUERY,
          mri: 'd:custom/sentry.event_manager.save@second',
          op: 'avg',
          query: '',
          groupBy: ['event_type'],
          displayType: MetricDisplayType.LINE,
          powerUserMode: false,
          focusedSeries: [{id: 'default', groupBy: {event_type: 'default'}}],
          sort: {name: 'sum', order: 'asc'},
          isHidden: false,
        },
        // Formulas should always be at the end
        {
          id: 0,
          type: MetricExpressionType.EQUATION,
          formula: 'a + b',
          displayType: MetricDisplayType.LINE,
          sort: {name: 'avg', order: 'desc'},
          focusedSeries: [],
          isHidden: true,
        },
      ]
    );
  });

  it('falls back to defaults', () => {
    // Missing values
    testParsing(
      // INPUT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
        },
        {
          type: MetricExpressionType.EQUATION,
          formula: 'a * 2',
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'avg',
          query: '',
          groupBy: [],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          powerUserMode: false,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
        },
        {
          id: 0,
          type: MetricExpressionType.EQUATION,
          formula: 'a * 2',
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
        },
      ]
    );

    // Invalid values
    testParsing(
      // INPUT
      [
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
          isHidden: 'foo',
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'avg',
          query: '',
          groupBy: [],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          powerUserMode: false,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
        },
      ]
    );
  });

  it('ignores invalid widgets', () => {
    testParsing(
      // INPUT
      [
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
          type: MetricExpressionType.EQUATION,
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'avg',
          query: '',
          groupBy: [],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          powerUserMode: false,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
        },
      ]
    );
  });

  it('returns default widget if there is no valid widget', () => {
    testParsing(
      // INPUT
      [
        {
          // Missing MRI
        },
        {
          // Missing formula
          type: MetricExpressionType.EQUATION,
        },
      ],
      // RESULT
      defaultState
    );
  });

  it('handles missing array in array params', () => {
    testParsing(
      // INPUT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: 'dist',
          displayType: 'line',
          focusedSeries: {id: 'default', groupBy: {dist: 'default'}},
          powerUserMode: true,
          sort: {order: 'asc'},
          isHidden: false,
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
        },
      ]
    );
  });

  it('adds missing ids', () => {
    function widgetWithId<T extends number | undefined>(id: T) {
      return {
        id,
        type: MetricExpressionType.QUERY as const,
        mri: 'd:transactions/duration@millisecond' as const,
        op: 'sum' as const,
        query: 'test:query',
        groupBy: ['dist'],
        displayType: MetricDisplayType.LINE,
        focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
        powerUserMode: true,
        sort: {name: 'avg' as const, order: 'desc' as const},
        isHidden: false,
      };
    }

    testParsing(
      // INPUT
      [
        widgetWithId(0),
        widgetWithId(undefined),
        widgetWithId(2),
        {
          // Invalid widget
        },
        widgetWithId(undefined),
        widgetWithId(3),
      ],
      // RESULT
      [
        widgetWithId(0),
        widgetWithId(1),
        widgetWithId(2),
        widgetWithId(4),
        widgetWithId(3),
      ]
    );
  });

  it('resets the id of a single widget to 0', () => {
    testParsing(
      // INPUT
      [
        {
          id: 5,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: 'line',
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: false,
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          op: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: false,
        },
      ]
    );
  });
});
