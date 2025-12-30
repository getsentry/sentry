import qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {PageFilters} from 'sentry/types/core';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {getWidgetMetricsUrl} from './getWidgetMetricsUrl';

function parseMetricsUrl(url: string) {
  const [pathname, search] = url.split('?');
  const params = qs.parse(search ?? '');
  return {pathname, params};
}

describe('getWidgetMetricsUrl', () => {
  const organization = OrganizationFixture({slug: 'test-org'});
  const selection: PageFilters = {
    datetime: {
      start: null,
      end: null,
      period: '14d',
      utc: null,
    },
    environments: ['production'],
    projects: [1, 2],
  };

  describe('basic functionality', () => {
    it('generates URL for single query with single aggregate', () => {
      const widget: Widget = {
        id: '1',
        title: 'Test Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: [],
            conditions: 'transaction:"/api/users"',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {pathname, params} = parseMetricsUrl(url);

      expect(pathname).toBe('/organizations/test-org/explore/metrics/');
      expect(params.project).toEqual(['1', '2']);
      expect(params.environment).toBe('production');
      expect(params.statsPeriod).toBe('14d');
      expect(params.title).toBe('Test Widget');
      expect(params.referrer).toBe('dashboards');
      expect(params.metric).toBeDefined();
      expect(Array.isArray(params.metric) ? params.metric.length : 1).toBe(1);
    });

    it('generates URL for multiple aggregates', () => {
      const widget: Widget = {
        id: '1',
        title: 'Multi Aggregate',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: [
              'avg(value,duration,d,-)',
              'p95(value,duration,d,-)',
              'count(value,duration,d,-)',
            ],
            columns: [],
            conditions: 'transaction:"/api/users"',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      // Should have 3 metric query parameters (one for each aggregate)
      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      expect(metrics).toHaveLength(3);
    });

    it('generates URL with group by columns', () => {
      const widget: Widget = {
        id: '1',
        title: 'Grouped Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: ['transaction', 'http.status_code'],
            conditions: '',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      // Decode and parse the metric query to check for group by fields
      const metricQuery = JSON.parse(metrics[0]!);
      expect(metricQuery.aggregateFields).toBeDefined();
      // Should have visualize + 2 group bys
      expect(metricQuery.aggregateFields).toHaveLength(3);
      expect(metricQuery.aggregateFields).toEqual([
        {chartType: ChartType.LINE, yAxes: ['avg(value,duration,d,-)']},
        {groupBy: 'transaction'},
        {groupBy: 'http.status_code'},
      ]);
    });

    it('applies dashboard filters to query conditions', () => {
      const widget: Widget = {
        id: '1',
        title: 'Filtered Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: [],
            conditions: 'transaction:"/api/users"',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const dashboardFilters: DashboardFilters = {
        release: ['v1.0.0'],
      };

      const url = getWidgetMetricsUrl(widget, dashboardFilters, selection, organization);
      const {params} = parseMetricsUrl(url);

      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const metricQuery = JSON.parse(metrics[0]!);
      // Dashboard filters should be applied to the query
      expect(metricQuery.query).toContain('release');
      expect(metricQuery.query).toContain('v1.0.0');
      expect(metricQuery.query).toContain('transaction:"/api/users"');
    });

    it('handles sort/orderby parameters', () => {
      const widget: Widget = {
        id: '1',
        title: 'Sorted Widget',
        displayType: DisplayType.TABLE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: ['transaction'],
            conditions: '',
            orderby: '-avg(value,duration,d,-)',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const metricQuery = JSON.parse(metrics[0]!);
      expect(metricQuery.aggregateSortBys).toBeDefined();
      expect(metricQuery.aggregateSortBys).toHaveLength(1);
      expect(metricQuery.aggregateSortBys[0].field).toBe('avg(value,duration,d,-)');
      expect(metricQuery.aggregateSortBys[0].kind).toBe('desc');
    });
  });

  describe('multiple queries', () => {
    it('creates metric queries for each (aggregate, query) combination', () => {
      const widget: Widget = {
        id: '1',
        title: 'Multi Query Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)', 'p95(value,duration,d,-)'],
            columns: [],
            conditions: 'transaction:"/api/users"',
            orderby: '',
            fieldAliases: [],
          },
          {
            name: 'Query 2',
            fields: [],
            aggregates: ['avg(value,duration,d,-)', 'p95(value,duration,d,-)'],
            columns: [],
            conditions: 'transaction:"/api/posts"',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      // Should have 4 metric queries (2 aggregates × 2 queries)
      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      expect(metrics).toHaveLength(4);

      // Should be grouped by aggregate (all avg together, then all p95 together)
      const parsedMetrics = metrics.map(metric => JSON.parse(metric as string));
      const avgMetrics = parsedMetrics.filter(m =>
        m.aggregateFields[0].yAxes[0].includes('avg')
      );
      const p95Metrics = parsedMetrics.filter(m =>
        m.aggregateFields[0].yAxes[0].includes('p95')
      );
      expect(avgMetrics).toHaveLength(2);
      expect(p95Metrics).toHaveLength(2);
    });

    it('applies different conditions to each query', () => {
      const widget: Widget = {
        id: '1',
        title: 'Different Conditions',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Success',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: [],
            conditions: 'http.status_code:200',
            orderby: '',
            fieldAliases: [],
          },
          {
            name: 'Errors',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: [],
            conditions: 'http.status_code:500',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      // Should have 2 metric queries (1 aggregate × 2 queries)
      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      expect(metrics).toHaveLength(2);

      const parsedMetrics = metrics.map(metric => JSON.parse(metric as string));
      expect(parsedMetrics[0].query).toContain('http.status_code:200');
      expect(parsedMetrics[1].query).toContain('http.status_code:500');
    });
  });

  describe('display type mapping', () => {
    it('maps LINE display type to LINE chart type', () => {
      const widget: Widget = {
        id: '1',
        title: 'Line Chart',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: [],
            conditions: '',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const metricQuery = JSON.parse(metrics[0]!);
      expect(metricQuery.aggregateFields[0].chartType).toBe(ChartType.LINE);
    });

    it('maps BAR display type to BAR chart type', () => {
      const widget: Widget = {
        id: '1',
        title: 'Bar Chart',
        displayType: DisplayType.BAR,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['count(value,duration,d,-)'],
            columns: [],
            conditions: '',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const metricQuery = JSON.parse(metrics[0]!);
      expect(metricQuery.aggregateFields[0].chartType).toBe(ChartType.BAR);
    });

    it('maps AREA display type to AREA chart type', () => {
      const widget: Widget = {
        id: '1',
        title: 'Area Chart',
        displayType: DisplayType.AREA,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['sum(value,duration,d,-)'],
            columns: [],
            conditions: '',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const metricQuery = JSON.parse(metrics[0]!);
      expect(metricQuery.aggregateFields[0].chartType).toBe(ChartType.AREA);
    });
  });

  it('handles empty query conditions', () => {
    const widget: Widget = {
      id: '1',
      title: 'Empty Conditions',
      displayType: DisplayType.LINE,
      interval: '5m',
      widgetType: WidgetType.TRACEMETRICS,
      queries: [
        {
          name: 'Query 1',
          fields: [],
          aggregates: ['avg(value,duration,d,-)'],
          columns: [],
          conditions: '',
          orderby: '',
          fieldAliases: [],
        },
      ],
    };

    const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
    const {params} = parseMetricsUrl(url);

    expect(params.metric).toBeDefined();
    const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
    const metricQuery = JSON.parse(metrics[0]!);
    expect(metricQuery.query).toBe('');
  });

  describe('datetime selection', () => {
    it('includes absolute datetime when start and end are provided', () => {
      const absoluteSelection: PageFilters = {
        datetime: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
          period: null,
          utc: true,
        },
        environments: [],
        projects: [1],
      };

      const widget: Widget = {
        id: '1',
        title: 'Absolute Time',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: ['avg(value,duration,d,-)'],
            columns: [],
            conditions: '',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, absoluteSelection, organization);
      const {params} = parseMetricsUrl(url);

      expect(params.start).toBe('2024-01-01T00:00:00Z');
      expect(params.end).toBe('2024-01-31T23:59:59Z');
      expect(params.utc).toBe('true');
      expect(params.statsPeriod).toBeUndefined();
    });
  });
});
