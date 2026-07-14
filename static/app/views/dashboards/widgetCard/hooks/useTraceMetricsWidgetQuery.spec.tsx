import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DisplayType} from 'sentry/views/dashboards/types';

import {
  useTraceMetricsHeatmapQuery,
  useTraceMetricsSeriesQuery,
  useTraceMetricsTableQuery,
} from './useTraceMetricsWidgetQuery';

jest.mock('sentry/views/dashboards/utils/widgetQueryQueue', () => ({
  useWidgetQueryQueue: () => ({queue: null}),
}));

describe('useTraceMetricsSeriesQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the events-timeseries endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['avg(value,test_metric,millisecond,none)'],
          aggregates: ['avg(value,test_metric,millisecond,none)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,none)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      },
    });

    renderHookWithProviders(() =>
      useTraceMetricsSeriesQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['avg(value,test_metric,millisecond,none)'],
          }),
        })
      );
    });
  });

  it('applies dashboard filters to widget query', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['avg(value,test_metric,millisecond,none)'],
          aggregates: ['avg(value,test_metric,millisecond,none)'],
          columns: [],
          conditions: 'environment:production',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'avg(value,test_metric,millisecond,none)',
            values: [{timestamp: 1, value: 100}],
            groupBy: [],
            meta: {
              interval: 0,
              valueType: 'number',
              valueUnit: null,
            },
          },
        ],
      },
    });

    renderHookWithProviders(() =>
      useTraceMetricsSeriesQuery({
        widget,
        organization,
        pageFilters,
        dashboardFilters: {
          release: ['1.0.0'],
        },
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('release:"1.0.0"'),
          }),
        })
      );
    });
  });

  it('includes groupBy query param when widget has columns', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['project', 'avg(value,test_metric,millisecond,none)'],
          aggregates: ['avg(value,test_metric,millisecond,none)'],
          columns: ['project'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [],
      },
    });

    renderHookWithProviders(() =>
      useTraceMetricsSeriesQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            groupBy: ['project'],
          }),
        })
      );
    });
  });
});

describe('useTraceMetricsTableQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the events endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['project', 'avg(value,test_metric,millisecond,none)'],
          aggregates: ['avg(value,test_metric,millisecond,none)'],
          columns: ['project'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            project: 'frontend',
            'avg(value,test_metric,millisecond,none)': 150,
          },
        ],
      },
    });

    renderHookWithProviders(() =>
      useTraceMetricsTableQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'tracemetrics',
          }),
        })
      );
    });
  });

  it('handles pagination parameters', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['project', 'avg(value,test_metric,millisecond,none)'],
          aggregates: ['avg(value,test_metric,millisecond,none)'],
          columns: ['project'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            project: 'frontend',
            'avg(value,test_metric,millisecond,none)': 150,
          },
        ],
      },
    });

    renderHookWithProviders(() =>
      useTraceMetricsTableQuery({
        widget,
        organization,
        pageFilters,
        limit: 25,
        cursor: 'test-cursor',
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 25,
            cursor: 'test-cursor',
          }),
        })
      );
    });
  });
});

describe('useTraceMetricsHeatmapQuery', () => {
  const organization = OrganizationFixture();
  // Set a narrow range to prevent windowed heat map requests, which keeps the
  // test simpler. The windowing is tested elsewhere.
  const pageFilters = PageFiltersFixture({
    datetime: {period: '1h', start: null, end: null, utc: null},
  });

  const heatmapWidget = WidgetFixture({
    displayType: DisplayType.HEATMAP,
    queries: [
      {
        name: '',
        fields: ['sum(value,test_metric,millisecond,none)'],
        aggregates: ['sum(value,test_metric,millisecond,none)'],
        columns: [],
        conditions: 'span.op:db',
        orderby: '',
      },
    ],
  });

  const heatmapResponse = {
    meta: {
      xAxis: {valueType: 'date', valueUnit: null},
      yAxis: {valueType: 'number', valueUnit: null, bucketCount: 10},
      zAxis: {valueType: 'integer', valueUnit: null},
    },
    values: [{xAxis: 1, yAxis: 0, zAxis: 5}],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('does not fetch until the chart is measured, but reports loading', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-heatmap/',
      body: heatmapResponse,
    });

    const {result} = renderHookWithProviders(() =>
      useTraceMetricsHeatmapQuery({
        widget: heatmapWidget,
        organization,
        pageFilters,
        enabled: true,
        widgetInterval: '1h',
        yBuckets: 0,
      })
    );

    // The query stays disabled until the chart is measured, but the hook still
    // reports loading (like the series/table hooks) so the chart container
    // doesn't need a heat-map-specific loading branch.
    expect(mockRequest).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    expect(result.current.heatmapResults).toBeUndefined();
  });

  it('does not fetch without an interval', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-heatmap/',
      body: heatmapResponse,
    });

    renderHookWithProviders(() =>
      useTraceMetricsHeatmapQuery({
        widget: heatmapWidget,
        organization,
        pageFilters,
        enabled: true,
        widgetInterval: '',
        yBuckets: 10,
      })
    );

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not fetch when the aggregate does not resolve to a metric', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-heatmap/',
      body: heatmapResponse,
    });

    const misconfiguredWidget = WidgetFixture({
      displayType: DisplayType.HEATMAP,
      queries: [
        {
          name: '',
          fields: ['sum(value)'],
          aggregates: ['sum(value)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    renderHookWithProviders(() =>
      useTraceMetricsHeatmapQuery({
        widget: misconfiguredWidget,
        organization,
        pageFilters,
        enabled: true,
        widgetInterval: '1h',
        yBuckets: 10,
      })
    );

    // The config error (getWidgetConfigError) stops the widget from rendering,
    // but the fetch-gate also keeps the request from firing without a metric.
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('fetches the events-heatmap endpoint with the selected metric', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-heatmap/',
      body: heatmapResponse,
    });

    renderHookWithProviders(() =>
      useTraceMetricsHeatmapQuery({
        widget: heatmapWidget,
        organization,
        pageFilters,
        enabled: true,
        widgetInterval: '1h',
        yBuckets: 10,
      })
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-heatmap/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'tracemetrics',
            xAxis: 'time',
            yAxis: 'value',
            zAxis: 'count()',
            interval: '1h',
            yBuckets: 10,
            query: expect.stringContaining('test_metric'),
          }),
        })
      );
    });
  });

  it("patches the Y axis with the selected metric's unit", async () => {
    const durationWidget = WidgetFixture({
      displayType: DisplayType.HEATMAP,
      queries: [
        {
          name: '',
          fields: ['count(value,test_metric,distribution,millisecond)'],
          aggregates: ['count(value,test_metric,distribution,millisecond)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'min(value)': 0,
            'max(value)': 100,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-heatmap/',
      body: heatmapResponse,
    });

    const {result} = renderHookWithProviders(() =>
      useTraceMetricsHeatmapQuery({
        widget: durationWidget,
        organization,
        pageFilters,
        enabled: true,
        widgetInterval: '1h',
        yBuckets: 10,
      })
    );

    // The API returns the generic `value` field with no unit; the hook patches
    // the Y axis from the metric's unit (millisecond -> duration).
    await waitFor(() => {
      expect(result.current.heatmapResults?.meta.yAxis.valueUnit).toBe('millisecond');
    });
    expect(result.current.heatmapResults?.meta.yAxis.valueType).toBe('duration');
  });
});
