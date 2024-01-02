import {MetricDisplayType} from 'sentry/utils/metrics';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
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
      widgetType: 'discover',
      limit: 1,
      queries: [
        {
          name: '',
          aggregates: ['p95(measurements.duration)'],
          columns: [],
          fields: ['p95(measurements.duration)'],
          conditions: '',
          orderby: '',
        },
      ],
    });
  });
});
