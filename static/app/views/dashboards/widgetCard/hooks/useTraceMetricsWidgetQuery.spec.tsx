import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DisplayType} from 'sentry/views/dashboards/types';

import {
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
          fields: ['avg(value,test_metric,millisecond,-)'],
          aggregates: ['avg(value,test_metric,millisecond,-)'],
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
            yAxis: ['avg(value,test_metric,millisecond,-)'],
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
          fields: ['avg(value,test_metric,millisecond,-)'],
          aggregates: ['avg(value,test_metric,millisecond,-)'],
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
          fields: ['project', 'avg(value,test_metric,millisecond,-)'],
          aggregates: ['avg(value,test_metric,millisecond,-)'],
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
          fields: ['project', 'avg(value,test_metric,millisecond,-)'],
          aggregates: ['avg(value,test_metric,millisecond,-)'],
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
            'avg(value,test_metric,millisecond,-)': 150,
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
          fields: ['project', 'avg(value,test_metric,millisecond,-)'],
          aggregates: ['avg(value,test_metric,millisecond,-)'],
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
            'avg(value,test_metric,millisecond,-)': 150,
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
