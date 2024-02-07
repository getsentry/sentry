import type {MRI} from 'sentry/types';
import {
  convertToDashboardWidget,
  getWidgetQuery,
  toDisplayType,
  toMetricDisplayType,
} from 'sentry/utils/metrics/dashboard';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {DisplayType} from 'sentry/views/dashboards/types';

describe('convertToDashboardWidget', () => {
  it('should convert a metrics query to a dashboard widget (metrics mri, with grouping)', () => {
    expect(
      convertToDashboardWidget(
        {
          datetime: {
            start: '2021-06-01T00:00:00',
            end: '2021-06-02T00:00:00',
            period: '1d',
            utc: false,
          },
          groupBy: ['project'],
          query: 'event.type:transaction',
          projects: [1],
          environments: ['prod'],
          mri: 'c:custom/login@second',
          op: 'p95',
        },
        MetricDisplayType.AREA
      )
    ).toEqual({
      title: 'p95(login)',
      displayType: DisplayType.AREA,
      widgetType: 'custom-metrics',
      limit: 10,
      queries: [
        {
          name: '',
          aggregates: ['p95(c:custom/login@second)'],
          columns: ['project'],
          fields: ['p95(c:custom/login@second)'],
          conditions: 'event.type:transaction',
          orderby: '',
        },
      ],
    });
  });

  it('should convert a metrics query to a dashboard widget (transaction mri, with grouping)', () => {
    expect(
      convertToDashboardWidget(
        {
          datetime: {
            start: '2021-06-01T00:00:00',
            end: '2021-06-02T00:00:00',
            period: '1d',
            utc: false,
          },
          groupBy: [],
          query: '',
          projects: [1],
          environments: ['prod'],
          mri: 'd:transactions/measurements.duration@second',
          op: 'p95',
        },
        MetricDisplayType.BAR
      )
    ).toEqual({
      title: 'p95(measurements.duration)',
      displayType: DisplayType.BAR,
      widgetType: 'custom-metrics',
      limit: 1,
      queries: [
        {
          name: '',
          aggregates: ['p95(d:transactions/measurements.duration@second)'],
          columns: [],
          fields: ['p95(d:transactions/measurements.duration@second)'],
          conditions: '',
          orderby: '',
        },
      ],
    });
  });
});

describe('toMetricDisplayType', () => {
  it('should return the displayType if it is a valid MetricDisplayType', () => {
    expect(MetricDisplayType.BAR).toEqual(toMetricDisplayType(DisplayType.BAR));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.LINE));
    expect(MetricDisplayType.AREA).toEqual(toMetricDisplayType(DisplayType.AREA));
  });

  it('should return MetricDisplayType.LINE if the displayType is invalid or unsupported', () => {
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.BIG_NUMBER));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.TABLE));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.TOP_N));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(undefined));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(''));
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
      orderby: '',
    };

    expect(getWidgetQuery(metricsQuery)).toEqual(expectedWidgetQuery);
  });
});
