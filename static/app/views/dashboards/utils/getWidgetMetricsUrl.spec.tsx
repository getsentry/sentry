import qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import type {PageFilters} from 'sentry/types/core';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/typesBase';
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
            aggregates: ['avg(value,duration,d,none)'],
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
              'avg(value,duration,d,none)',
              'p95(value,duration,d,none)',
              'count(value,duration,d,none)',
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
            aggregates: ['avg(value,duration,d,none)'],
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
        {chartType: ChartType.LINE, yAxes: ['avg(value,duration,d,none)']},
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
            aggregates: ['avg(value,duration,d,none)'],
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
            aggregates: ['avg(value,duration,d,none)'],
            columns: ['transaction'],
            conditions: '',
            orderby: '-avg(value,duration,d,none)',
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
      expect(metricQuery.aggregateSortBys[0].field).toBe('avg(value,duration,d,none)');
      expect(metricQuery.aggregateSortBys[0].kind).toBe('desc');
    });

    it('handles the unit of the metric', () => {
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: '',
            fields: [],
            aggregates: ['avg(value,test-metric,distribution,second)'],
            columns: [],
            conditions: '',
            orderby: '',
            fieldAliases: [],
          },
        ],
      });

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const metricQuery = JSON.parse(metrics[0]!);
      expect(metricQuery.metric.unit).toBe('second');
    });

    it('reads the tracemetric from each aggregate', () => {
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
              'avg(value,test_metric_a,duration,none)',
              'p95(value,test_metric_b,gauge,none)',
              'count(value,test_metric_c,counter,none)',
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

      const parsedMetrics = metrics.map(metric => JSON.parse(metric!));
      expect(parsedMetrics).toHaveLength(3);
      expect(parsedMetrics.map(m => m.metric)).toEqual([
        {name: 'test_metric_a', type: 'duration', unit: 'none'},
        {name: 'test_metric_b', type: 'gauge', unit: 'none'},
        {name: 'test_metric_c', type: 'counter', unit: 'none'},
      ]);
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
            aggregates: ['avg(value,duration,d,none)', 'p95(value,duration,d,none)'],
            columns: [],
            conditions: 'transaction:"/api/users"',
            orderby: '',
            fieldAliases: [],
          },
          {
            name: 'Query 2',
            fields: [],
            aggregates: ['avg(value,duration,d,none)', 'p95(value,duration,d,none)'],
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
      const parsedMetrics = metrics.map(metric => JSON.parse(metric!));
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
            aggregates: ['avg(value,duration,d,none)'],
            columns: [],
            conditions: 'http.status_code:200',
            orderby: '',
            fieldAliases: [],
          },
          {
            name: 'Errors',
            fields: [],
            aggregates: ['avg(value,duration,d,none)'],
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

      const parsedMetrics = metrics.map(metric => JSON.parse(metric!));
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
            aggregates: ['avg(value,duration,d,none)'],
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
            aggregates: ['count(value,duration,d,none)'],
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
            aggregates: ['sum(value,duration,d,none)'],
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
          aggregates: ['avg(value,duration,d,none)'],
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

  describe('equations', () => {
    it('parses equation into sub-component metric queries and equation row', () => {
      const widget: Widget = {
        id: '1',
        title: 'Equation Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [
              'equation|avg(value,duration,distribution,none) + count(value,requests,counter,none)',
              'transaction',
            ],
            aggregates: [
              'equation|avg(value,duration,distribution,none) + count(value,requests,counter,none)',
            ],
            columns: ['transaction'],
            conditions: 'transaction:"/api/users"',
            orderby: '',
            fieldAliases: [],
          },
        ],
      };

      const url = getWidgetMetricsUrl(widget, undefined, selection, organization);
      const {params} = parseMetricsUrl(url);

      expect(params.metric).toBeDefined();
      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      // 2 sub-component queries + 1 equation row
      expect(metrics).toHaveLength(3);

      const parsedMetrics = metrics.map(metric => JSON.parse(metric!));

      expect(parsedMetrics[0].metric).toEqual({
        name: 'duration',
        type: 'distribution',
        unit: 'none',
      });
      expect(parsedMetrics[0].aggregateFields[0].yAxes[0]).toBe(
        'avg(value,duration,distribution,none)'
      );

      expect(parsedMetrics[1].metric).toEqual({
        name: 'requests',
        type: 'counter',
        unit: 'none',
      });
      expect(parsedMetrics[1].aggregateFields).toHaveLength(1);
      expect(parsedMetrics[1].aggregateFields[0].groupBy).toBeUndefined();
      expect(parsedMetrics[1].aggregateFields[0].yAxes[0]).toBe(
        'count(value,requests,counter,none)'
      );

      // 2 fields, one for the equation and one for the group by
      expect(parsedMetrics[2].aggregateFields).toHaveLength(2);
      expect(parsedMetrics[2].aggregateFields[0].yAxes[0]).toBe(
        'equation|avg(value,duration,distribution,none) + count(value,requests,counter,none)'
      );
      expect(parsedMetrics[2].aggregateFields[1].groupBy).toBe('transaction');
      expect(parsedMetrics[2].query).toContain('transaction:"/api/users"');
    });

    it('applies dashboard filters to equation query', () => {
      const widget: Widget = {
        id: '1',
        title: 'Filtered Equation',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: [
              'equation|avg(value,duration,distribution,none) + count(value,duration,distribution,none)',
            ],
            columns: [],
            conditions: '',
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

      const metrics = Array.isArray(params.metric) ? params.metric : [params.metric];
      const parsedMetrics = metrics.map(metric => JSON.parse(metric!));

      // The equation row should have dashboard filters applied
      const equationRow = parsedMetrics[parsedMetrics.length - 1];
      expect(equationRow.query).toContain('release');
      expect(equationRow.query).toContain('v1.0.0');
    });

    it('handles equation with duplicate function calls', () => {
      const widget: Widget = {
        id: '1',
        title: 'Duplicate Funcs',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: [
              'equation|avg(value,duration,distribution,none) + avg(value,duration,distribution,none)',
            ],
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
      // 1 unique sub-component + 1 equation row (duplicates are collapsed)
      expect(metrics).toHaveLength(2);
    });

    it('handles equations with conditional subcomponents', () => {
      const widget: Widget = {
        id: '1',
        title: 'Conditional Equation',
        displayType: DisplayType.LINE,
        interval: '5m',
        widgetType: WidgetType.TRACEMETRICS,
        queries: [
          {
            name: 'Query 1',
            fields: [],
            aggregates: [
              'equation|avg_if(`environment:prod`,value,duration,distribution,none) + count(value,duration,distribution,none)',
            ],
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
      const parsedMetrics = metrics.map(metric => JSON.parse(metric!));

      expect(parsedMetrics).toHaveLength(3);

      // First subcomponent is normalized from avg_if to avg with a filter query
      expect(parsedMetrics[0].metric).toEqual({
        name: 'duration',
        type: 'distribution',
        unit: 'none',
      });
      expect(parsedMetrics[0].query).toContain('environment:prod');
      expect(parsedMetrics[0].aggregateFields[0].yAxes[0]).toBe(
        'avg(value,duration,distribution,none)'
      );
      expect(parsedMetrics[1].metric).toEqual({
        name: 'duration',
        type: 'distribution',
        unit: 'none',
      });
      expect(parsedMetrics[1].query).toBe('');
      expect(parsedMetrics[1].aggregateFields[0].yAxes[0]).toBe(
        'count(value,duration,distribution,none)'
      );
      expect(parsedMetrics[2].aggregateFields[0].yAxes[0]).toBe(
        'equation|avg_if(`environment:prod`,value,duration,distribution,none) + count(value,duration,distribution,none)'
      );
    });
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
            aggregates: ['avg(value,duration,d,none)'],
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
