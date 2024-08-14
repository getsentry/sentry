import {
  MetricChartOverlayType,
  MetricDisplayType,
  MetricExpressionType,
  type MetricsWidget,
} from 'sentry/utils/metrics/types';
import {parseMetricWidgetsQueryParam} from 'sentry/views/metrics/utils/parseMetricWidgetsQueryParam';

function testParsing(input: any, result: MetricsWidget[]) {
  expect(parseMetricWidgetsQueryParam(JSON.stringify(input))).toStrictEqual(result);
}

describe('parseMetricWidgetsQueryParam', () => {
  it('returns empty array for invalid param', () => {
    testParsing(undefined, []);
    testParsing({}, []);
    testParsing(true, []);
    testParsing(2, []);
    testParsing('', []);
    testParsing('test', []);
    testParsing([], []);
  });

  it('returns a single widget', () => {
    testParsing(
      [
        // INPUT
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          aggregation: 'sum',
          condition: 1,
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
          aggregation: 'sum',
          condition: 1,
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: undefined, order: 'asc'},
          isHidden: true,
          overlays: [MetricChartOverlayType.SAMPLES],
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
          aggregation: 'sum',
          condition: 1,
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
          aggregation: 'avg',
          condition: 1,
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
          aggregation: 'sum',
          condition: 1,
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: true,
          overlays: [MetricChartOverlayType.SAMPLES],
        },
        {
          id: 1,
          type: MetricExpressionType.QUERY,
          mri: 'd:custom/sentry.event_manager.save@second',
          aggregation: 'avg',
          condition: 1,
          query: '',
          groupBy: ['event_type'],
          displayType: MetricDisplayType.LINE,
          powerUserMode: false,
          focusedSeries: [{id: 'default', groupBy: {event_type: 'default'}}],
          sort: {name: 'sum', order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
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
          overlays: [MetricChartOverlayType.SAMPLES],
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
          aggregation: 'avg',
          condition: undefined,
          query: '',
          groupBy: [],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          powerUserMode: false,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
        },
        {
          id: 0,
          type: MetricExpressionType.EQUATION,
          formula: 'a * 2',
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
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
          aggregation: 1,
          condition: 'test',
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
          aggregation: 'avg',
          condition: undefined,
          query: '',
          groupBy: [],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          powerUserMode: false,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
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
          aggregation: 'avg',
          condition: undefined,
          query: '',
          groupBy: [],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [],
          powerUserMode: false,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
        },
      ]
    );
  });

  it('returns empty array if there is no valid widget', () => {
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
      []
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
          condition: 1,
          aggregation: 'sum',
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
          condition: 1,
          aggregation: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
        },
      ]
    );
  });

  it('handles overlays array in array params', () => {
    testParsing(
      // INPUT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          condition: 1,
          aggregation: 'sum',
          query: 'test:query',
          groupBy: 'dist',
          displayType: 'line',
          focusedSeries: {id: 'default', groupBy: {dist: 'default'}},
          powerUserMode: true,
          sort: {order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES, MetricChartOverlayType.RELEASES],
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          condition: 1,
          aggregation: 'sum',
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: undefined, order: 'asc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES, MetricChartOverlayType.RELEASES],
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
        aggregation: 'sum' as const,
        condition: 1,
        query: 'test:query',
        groupBy: ['dist'],
        displayType: MetricDisplayType.LINE,
        focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
        powerUserMode: true,
        sort: {name: 'avg' as const, order: 'desc' as const},
        isHidden: false,
        overlays: [MetricChartOverlayType.SAMPLES],
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
          aggregation: 'sum',
          condition: 1,
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
          aggregation: 'sum',
          condition: 1,
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
        },
      ]
    );
  });

  it('tries to parse op if aggregation is not present', () => {
    testParsing(
      // INPUT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          condition: 1,
          query: 'test:query',
          groupBy: ['dist'],
          displayType: 'line',
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: false,
          op: 'avg',
        },
      ],
      // RESULT
      [
        {
          id: 0,
          type: MetricExpressionType.QUERY,
          mri: 'd:transactions/duration@millisecond',
          aggregation: 'avg',
          condition: 1,
          query: 'test:query',
          groupBy: ['dist'],
          displayType: MetricDisplayType.LINE,
          focusedSeries: [{id: 'default', groupBy: {dist: 'default'}}],
          powerUserMode: true,
          sort: {name: 'avg', order: 'desc'},
          isHidden: false,
          overlays: [MetricChartOverlayType.SAMPLES],
        },
      ]
    );
  });
});
