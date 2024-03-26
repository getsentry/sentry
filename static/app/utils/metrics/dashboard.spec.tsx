import type {MRI} from 'sentry/types';
import {
  convertToDashboardWidget,
  getWidgetQuery,
  toDisplayType,
} from 'sentry/utils/metrics/dashboard';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {DisplayType} from 'sentry/views/dashboards/types';

describe('convertToDashboardWidget', () => {
  it('should convert a metrics query to a dashboard widget (metrics mri, with grouping)', () => {
    expect(
      convertToDashboardWidget(
        [
          {
            groupBy: ['project'],
            query: 'event.type:transaction',
            mri: 'c:custom/login@second',
            op: 'p95',
            id: 1,
          },
        ],
        MetricDisplayType.AREA
      )
    ).toEqual({
      title: '',
      displayType: DisplayType.AREA,
      widgetType: 'custom-metrics',
      limit: 10,
      queries: [
        {
          name: '1',
          aggregates: ['p95(c:custom/login@second)'],
          columns: ['project'],
          fields: ['p95(c:custom/login@second)'],
          conditions: 'event.type:transaction',
          orderby: undefined,
        },
      ],
    });
  });

  it('should convert a metrics query to a dashboard widget (transaction mri, with grouping)', () => {
    expect(
      convertToDashboardWidget(
        [
          {
            groupBy: [],
            query: '',
            mri: 'd:transactions/measurements.duration@second',
            op: 'p95',
          },
        ],
        MetricDisplayType.BAR
      )
    ).toEqual({
      title: '',
      displayType: DisplayType.BAR,
      widgetType: 'custom-metrics',
      limit: 10,
      queries: [
        {
          name: '',
          aggregates: ['p95(d:transactions/measurements.duration@second)'],
          columns: [],
          fields: ['p95(d:transactions/measurements.duration@second)'],
          conditions: '',
          orderby: undefined,
        },
      ],
    });
  });

  it('should convert a metrics formula to a dashboard widget (transaction mri, with grouping)', () => {
    expect(
      convertToDashboardWidget(
        [
          {
            id: 0,
            groupBy: [],
            query: '',
            mri: 'd:transactions/measurements.duration@second',
            op: 'p95',
            isHidden: true,
          },
          {
            formula: '$b / 2',
            isHidden: false,
          },
        ],
        MetricDisplayType.BAR
      )
    ).toEqual({
      title: '',
      displayType: DisplayType.BAR,
      widgetType: 'custom-metrics',
      limit: 10,
      queries: [
        {
          name: '0',
          aggregates: ['p95(d:transactions/measurements.duration@second)'],
          columns: [],
          fields: ['p95(d:transactions/measurements.duration@second)'],
          conditions: '',
          orderby: undefined,
          isHidden: true,
        },
        {
          name: '',
          aggregates: ['equation|$b / 2'],
          columns: [],
          fields: ['equation|$b / 2'],
          conditions: '',
          orderby: undefined,
          isHidden: false,
        },
      ],
    });
  });
});

describe('getWidgetQuery', () => {
  const metricsQueryBase = {
    datetime: {start: '2022-01-01', end: '2022-01-31', period: null, utc: false},
    environments: ['production'],
    projects: [1],
    groupBy: [],
    query: '',
  };

  it('should return the correct widget query object', () => {
    // Arrange
    const metricsQuery = {
      ...metricsQueryBase,
      mri: 'd:custom/sentry.events.symbolicator.query_task@second' as MRI,
      op: 'sum',
      query: 'status = "success"',
      title: 'Example Widget',
    };

    const expectedWidgetQuery = {
      name: '',
      aggregates: ['sum(d:custom/sentry.events.symbolicator.query_task@second)'],
      columns: [],
      fields: ['sum(d:custom/sentry.events.symbolicator.query_task@second)'],
      conditions: 'status = "success"',
      orderby: undefined,
    };

    expect(getWidgetQuery(metricsQuery)).toEqual(expectedWidgetQuery);
  });
});

describe('toDisplayType', () => {
  it('should return the displayType if it is a valid MetricDisplayType', () => {
    expect(DisplayType.BAR).toEqual(toDisplayType(DisplayType.BAR));
    expect(DisplayType.LINE).toEqual(toDisplayType(DisplayType.LINE));
    expect(DisplayType.AREA).toEqual(toDisplayType(DisplayType.AREA));
    expect(DisplayType.BIG_NUMBER).toEqual(toDisplayType(DisplayType.BIG_NUMBER));
    expect(DisplayType.TABLE).toEqual(toDisplayType(DisplayType.TABLE));
    expect(DisplayType.TOP_N).toEqual(toDisplayType(DisplayType.TOP_N));
  });

  it('should return DisplayType.LINE if the displayType is invalid or unsupported', () => {
    expect(DisplayType.LINE).toEqual(toDisplayType(undefined));
    expect(DisplayType.LINE).toEqual(toDisplayType(''));
  });
});
