import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {DisplayType} from 'sentry/views/dashboards/types';

import {
  useTransactionsSeriesQuery,
  useTransactionsTableQuery,
} from './useTransactionsWidgetQuery';

jest.mock('sentry/views/dashboards/utils/widgetQueryQueue', () => ({
  useWidgetQueryQueue: () => ({queue: null}),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({children}: {children: React.ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTransactionsSeriesQuery', () => {
  const organization = OrganizationFixture({
    features: ['on-demand-metrics-extraction', 'on-demand-metrics-ui-widgets'],
  });
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the events-stats endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [],
      },
    });

    renderHook(
      () =>
        useTransactionsSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['count()'],
            dataset: DiscoverDatasets.TRANSACTIONS,
          }),
        })
      );
    });
  });

  it('makes a request to the metrics enhanced dataset with the correct mep state', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [],
      },
    });

    renderHook(
      () =>
        useTransactionsSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
          mepSetting: MEPState.AUTO,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.METRICS_ENHANCED,
          }),
        })
      );
    });
  });
});

describe('useTransactionsTableQuery', () => {
  const organization = OrganizationFixture({
    features: ['on-demand-metrics-extraction', 'on-demand-metrics-ui-widgets'],
  });
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
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
      },
    });

    renderHook(
      () =>
        useTransactionsTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'transactions',
          }),
        })
      );
    });
  });

  it('makes a request to the metrics enhanced dataset with the correct mep state', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
      },
    });

    renderHook(
      () =>
        useTransactionsTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
          mepSetting: MEPState.AUTO,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.METRICS_ENHANCED,
          }),
        })
      );
    });
  });
});
