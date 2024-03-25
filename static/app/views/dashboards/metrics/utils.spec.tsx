import {MetricDisplayType, MetricQueryType} from 'sentry/utils/metrics/types';
import type {DashboardMetricsExpression} from 'sentry/views/dashboards/metrics/types';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {expressionsToWidget, getMetricExpressions, toMetricDisplayType} from './utils';

describe('getMetricExpressions function', () => {
  it('should return a query', () => {
    const widget = {
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:bar',
          columns: ['release'],
          name: 'query_1',
          orderby: 'asc',
        },
      ],
    } as Widget;

    const metricQueries = getMetricExpressions(widget);
    expect(metricQueries).toEqual([
      {
        groupBy: ['release'],
        id: 0,
        mri: 'd:transactions/duration@milisecond',
        op: 'avg',
        query: 'foo:bar',
        type: MetricQueryType.QUERY,
        orderBy: 'asc',
        isHidden: false,
      } satisfies DashboardMetricsExpression,
    ]);
  });

  it('should return an equation', () => {
    const widget = {
      queries: [
        {
          aggregates: ['equation|$a + $b'],
          conditions: 'foo:bar',
          columns: ['release'],
          name: 'query_1',
        },
      ],
    } as Widget;

    const metricQueries = getMetricExpressions(widget);
    expect(metricQueries).toEqual([
      {
        id: 0,
        formula: '$a + $b',
        type: MetricQueryType.FORMULA,
        isHidden: false,
      } satisfies DashboardMetricsExpression,
    ]);
  });

  it('should return metricQueries with correct parameters with dashboardFilters', () => {
    const widget = {
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:bar',
          columns: ['release'],
          name: '0',
          orderby: 'desc',
        },
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:baz',
          columns: [],
          name: '1',
          orderby: '',
        },
      ],
    } as Widget;

    const metricQueries = getMetricExpressions(widget, {release: ['1.0']});

    expect(metricQueries).toEqual([
      {
        groupBy: ['release'],
        id: 0,
        mri: 'd:transactions/duration@milisecond',
        op: 'avg',
        query: 'foo:bar release:1.0',
        type: MetricQueryType.QUERY,
        orderBy: 'desc',
        isHidden: false,
      } satisfies DashboardMetricsExpression,
      {
        groupBy: [],
        id: 1,
        mri: 'd:transactions/duration@milisecond',
        op: 'avg',
        query: 'foo:baz release:1.0',
        type: MetricQueryType.QUERY,
        orderBy: undefined,
        isHidden: false,
      } satisfies DashboardMetricsExpression,
    ]);
  });

  it('should return metricQueries with correct parameters with multiple dashboardFilters', () => {
    const widget = {
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: '',
          columns: ['release'],
          name: '1',
        },
      ],
    } as Widget;

    const metricQueries = getMetricExpressions(widget, {release: ['1.0', '2.0']});

    expect(metricQueries).toEqual([
      {
        groupBy: ['release'],
        id: 1,
        mri: 'd:transactions/duration@milisecond',
        op: 'avg',
        query: 'release:[1.0,2.0]',
        type: MetricQueryType.QUERY,
        orderBy: undefined,
        isHidden: false,
      } satisfies DashboardMetricsExpression,
    ]);
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

describe('expressionsToWidget', () => {
  it('should return a widget with queries', () => {
    const metricExpressions = [
      {
        groupBy: ['release'],
        id: 0,
        mri: 'd:transactions/duration@milisecond',
        op: 'avg',
        query: 'foo:bar',
        type: MetricQueryType.QUERY,
        orderBy: 'asc',
        isHidden: true,
      } satisfies DashboardMetricsExpression,
    ];

    const widget = expressionsToWidget(metricExpressions, 'title', DisplayType.LINE);

    expect(widget).toEqual({
      title: 'title',
      displayType: DisplayType.LINE,
      interval: '5m',
      limit: 10,
      widgetType: WidgetType.METRICS,
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          fields: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:bar',
          columns: ['release'],
          name: '0',
          orderby: 'asc',
          isHidden: true,
        },
      ],
    } satisfies Widget);
  });

  it('should return a widget with equations', () => {
    const metricExpressions = [
      {
        id: 1,
        formula: '$a + $b',
        type: MetricQueryType.FORMULA,
        isHidden: false,
      } satisfies DashboardMetricsExpression,
    ];

    const widget = expressionsToWidget(metricExpressions, 'title', DisplayType.LINE);

    expect(widget).toEqual({
      title: 'title',
      displayType: DisplayType.LINE,
      interval: '5m',
      limit: 10,
      widgetType: WidgetType.METRICS,
      queries: [
        {
          aggregates: ['equation|$a + $b'],
          fields: ['equation|$a + $b'],
          conditions: '',
          columns: [],
          name: '1',
          orderby: '',
          isHidden: false,
        },
      ],
    } satisfies Widget);
  });

  it('should should be reversible by getMetricExpressions', () => {
    const metricExpressions = [
      {
        groupBy: ['release'],
        id: 0,
        mri: 'd:transactions/duration@milisecond',
        op: 'avg',
        query: 'foo:bar',
        type: MetricQueryType.QUERY,
        orderBy: 'asc',
        isHidden: true,
      } satisfies DashboardMetricsExpression,
      {
        id: 1,
        formula: '$a + $b',
        type: MetricQueryType.FORMULA,
        isHidden: false,
      } satisfies DashboardMetricsExpression,
    ];

    const widget = expressionsToWidget(metricExpressions, 'title', DisplayType.LINE);

    expect(getMetricExpressions(widget)).toEqual(metricExpressions);
  });
});
