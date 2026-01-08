import {OrganizationFixture} from 'sentry-fixture/organization';

import type {Organization} from 'sentry/types/organization';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import type {WidgetQuery} from 'sentry/views/dashboards/types';

describe('TraceMetricsConfig', () => {
  let organization: Organization;
  beforeEach(() => {
    organization = OrganizationFixture();
  });
  describe('transformSeries', () => {
    it('uniquely identifies series with single yAxis and no groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: '',
        fields: [],
        columns: [],
        fieldAliases: [],
        aggregates: ['avg(value,test_metric,millisecond,-)'],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(1);
      expect(result[0]!.seriesName).toBe('avg(test_metric)');
    });

    it('uniquely identifies series with multiple yAxes and no groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 80}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: '',
        fields: [],
        columns: [],
        fieldAliases: [],
        aggregates: [
          'avg(value,test_metric,millisecond,-)',
          'p50(value,test_metric,millisecond,-)',
        ],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(2);
      expect(result[0]!.seriesName).toBe('avg(test_metric)');
      expect(result[1]!.seriesName).toBe('p50(test_metric)');
    });

    it('uniquely identifies series with single yAxis and groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [{key: 'project', value: 'frontend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 200}],
            groupBy: [{key: 'project', value: 'backend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: '',
        fields: [],
        columns: ['project'],
        fieldAliases: [],
        aggregates: ['avg(value,test_metric,millisecond,-)'],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(2);
      // With single yAxis, grouping value is used as the series name
      expect(result[0]!.seriesName).toBe('frontend');
      expect(result[1]!.seriesName).toBe('backend');
    });

    it('uniquely identifies series with multiple yAxes and groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [{key: 'project', value: 'frontend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 200}],
            groupBy: [{key: 'project', value: 'backend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 80}],
            groupBy: [{key: 'project', value: 'frontend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 160}],
            groupBy: [{key: 'project', value: 'backend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: '',
        fields: [],
        columns: ['project'],
        fieldAliases: [],
        aggregates: [
          'avg(value,test_metric,millisecond,-)',
          'p50(value,test_metric,millisecond,-)',
        ],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(4);
      // With multiple yAxes and groupings, series names should include function name
      // to uniquely identify them
      expect(result[0]!.seriesName).toBe('frontend : avg(…)');
      expect(result[1]!.seriesName).toBe('backend : avg(…)');
      expect(result[2]!.seriesName).toBe('frontend : p50(…)');
      expect(result[3]!.seriesName).toBe('backend : p50(…)');
    });

    it('uniquely identifies series with multiple groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [
              {key: 'project', value: 'frontend'},
              {key: 'environment', value: 'production'},
            ],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 200}],
            groupBy: [
              {key: 'project', value: 'frontend'},
              {key: 'environment', value: 'staging'},
            ],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 80}],
            groupBy: [
              {key: 'project', value: 'frontend'},
              {key: 'environment', value: 'production'},
            ],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 160}],
            groupBy: [
              {key: 'project', value: 'frontend'},
              {key: 'environment', value: 'staging'},
            ],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: '',
        fields: [],
        columns: ['project', 'environment'],
        fieldAliases: [],
        aggregates: [
          'avg(value,test_metric,millisecond,-)',
          'p50(value,test_metric,millisecond,-)',
        ],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(4);
      // Multiple groupings should be comma-separated, with function name appended
      expect(result[0]!.seriesName).toBe('frontend,production : avg(…)');
      expect(result[1]!.seriesName).toBe('frontend,staging : avg(…)');
      expect(result[2]!.seriesName).toBe('frontend,production : p50(…)');
      expect(result[3]!.seriesName).toBe('frontend,staging : p50(…)');
    });

    it('handles null groupBy values', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [{key: 'project', value: null}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 80}],
            groupBy: [{key: 'project', value: null}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: '',
        fields: [],
        columns: ['project'],
        fieldAliases: [],
        aggregates: [
          'avg(value,test_metric,millisecond,-)',
          'p50(value,test_metric,millisecond,-)',
        ],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(2);
      // Null values should be labeled "(no value)" and include function name for uniqueness
      expect(result[0]!.seriesName).toBe('(no value) : avg(…)');
      expect(result[1]!.seriesName).toBe('(no value) : p50(…)');
    });

    it('prefixes series names with query name using : separator for single aggregate and no groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: 'My Query',
        fields: [],
        columns: [],
        fieldAliases: [],
        aggregates: ['avg(value,test_metric,millisecond,-)'],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(1);
      expect(result[0]!.seriesName).toBe('My Query : avg(test_metric)');
    });

    it('prefixes series names with query name using : separator for multiple aggregates and no groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 80}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: 'My Query',
        fields: [],
        columns: [],
        fieldAliases: [],
        aggregates: [
          'avg(value,test_metric,millisecond,-)',
          'p50(value,test_metric,millisecond,-)',
        ],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(2);
      expect(result[0]!.seriesName).toBe('My Query : avg(test_metric)');
      expect(result[1]!.seriesName).toBe('My Query : p50(test_metric)');
    });

    it('prefixes series names with query name using : separator for single aggregate with groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [{key: 'project', value: 'frontend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 200}],
            groupBy: [{key: 'project', value: 'backend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: 'My Query',
        fields: [],
        columns: ['project'],
        fieldAliases: [],
        aggregates: ['avg(value,test_metric,millisecond,-)'],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(2);
      expect(result[0]!.seriesName).toBe('My Query : frontend');
      expect(result[1]!.seriesName).toBe('My Query : backend');
    });

    it('prefixes series names with query name using > separator for multiple aggregates and groupings', () => {
      const data: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [{key: 'project', value: 'frontend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 200}],
            groupBy: [{key: 'project', value: 'backend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 80}],
            groupBy: [{key: 'project', value: 'frontend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'p50(value,test_metric,millisecond,-)',
            values: [{timestamp: 1, value: 160}],
            groupBy: [{key: 'project', value: 'backend'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery: WidgetQuery = {
        name: 'My Query',
        fields: [],
        columns: ['project'],
        fieldAliases: [],
        aggregates: [
          'avg(value,test_metric,millisecond,-)',
          'p50(value,test_metric,millisecond,-)',
        ],
        conditions: '',
        orderby: '',
      };

      const result = TraceMetricsConfig.transformSeries!(data, widgetQuery, organization);

      expect(result).toHaveLength(4);
      // With query name, multiple aggregates AND groupings, use > separator
      expect(result[0]!.seriesName).toBe('My Query > frontend : avg(…)');
      expect(result[1]!.seriesName).toBe('My Query > backend : avg(…)');
      expect(result[2]!.seriesName).toBe('My Query > frontend : p50(…)');
      expect(result[3]!.seriesName).toBe('My Query > backend : p50(…)');
    });

    it('distinguishes series from different widget queries using their query names', () => {
      // Simulate data from first query named "Database Metrics"
      const data1: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,db_latency,millisecond,-)',
            values: [{timestamp: 1, value: 150}],
            groupBy: [{key: 'environment', value: 'prod'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,db_latency,millisecond,-)',
            values: [{timestamp: 1, value: 75}],
            groupBy: [{key: 'environment', value: 'dev'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery1: WidgetQuery = {
        name: 'Database Metrics',
        fields: [],
        columns: ['environment'],
        fieldAliases: [],
        aggregates: ['avg(value,db_latency,millisecond,-)'],
        conditions: '',
        orderby: '',
      };

      // Simulate data from second query named "Cache Metrics"
      const data2: EventsTimeSeriesResponse = {
        timeSeries: [
          {
            yAxis: 'avg(value,cache_hits,counter,-)',
            values: [{timestamp: 1, value: 980}],
            groupBy: [{key: 'environment', value: 'prod'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
          {
            yAxis: 'avg(value,cache_hits,counter,-)',
            values: [{timestamp: 1, value: 920}],
            groupBy: [{key: 'environment', value: 'dev'}],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      };

      const widgetQuery2: WidgetQuery = {
        name: 'Cache Metrics',
        fields: [],
        columns: ['environment'],
        fieldAliases: [],
        aggregates: ['avg(value,cache_hits,counter,-)'],
        conditions: '',
        orderby: '',
      };

      const result1 = TraceMetricsConfig.transformSeries!(
        data1,
        widgetQuery1,
        organization
      );
      const result2 = TraceMetricsConfig.transformSeries!(
        data2,
        widgetQuery2,
        organization
      );

      // Verify first query produces labels with "Database Metrics"
      expect(result1).toHaveLength(2);
      expect(result1[0]!.seriesName).toBe('Database Metrics : prod');
      expect(result1[1]!.seriesName).toBe('Database Metrics : dev');

      // Verify second query produces labels with "Cache Metrics"
      expect(result2).toHaveLength(2);
      expect(result2[0]!.seriesName).toBe('Cache Metrics : prod');
      expect(result2[1]!.seriesName).toBe('Cache Metrics : dev');
    });
  });
});
