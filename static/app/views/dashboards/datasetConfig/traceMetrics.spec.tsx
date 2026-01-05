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
  });
});
