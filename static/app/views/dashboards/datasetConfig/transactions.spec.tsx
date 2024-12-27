import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import type {Client} from 'sentry/api';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';

describe('TransactionsConfig', function () {
  describe('getEventsRequest', function () {
    let api!: Client;
    let organization!: ReturnType<typeof OrganizationFixture>;
    let mockEventsRequest!: jest.Mock;
    let mockEventsStatsRequest!: jest.Mock;

    beforeEach(function () {
      MockApiClient.clearMockResponses();

      api = new MockApiClient();
      organization = OrganizationFixture({
        features: ['on-demand-metrics-extraction', 'on-demand-metrics-ui-widgets'],
      });

      mockEventsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          data: [],
        },
      });

      mockEventsStatsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {
          data: [],
        },
      });
    });

    it('makes table request to the transactions dataset', function () {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      TransactionsConfig.getTableRequest!(
        api,
        widget,
        {
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
        },
        organization,
        pageFilters
      );

      expect(mockEventsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.TRANSACTIONS,
            useOnDemandMetrics: false,
          }),
        })
      );
    });

    it('makes table request to the metrics enhanced dataset with the correct mep state', function () {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      TransactionsConfig.getTableRequest!(
        api,
        widget,
        {
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
        },
        organization,
        pageFilters,
        undefined,
        undefined,
        undefined,
        undefined,
        MEPState.AUTO
      );

      expect(mockEventsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.METRICS_ENHANCED,
            useOnDemandMetrics: false,
          }),
        })
      );
    });

    it('makes table request with on demand', function () {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      TransactionsConfig.getTableRequest!(
        api,
        widget,
        {
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
        },
        organization,
        pageFilters,
        {
          setForceOnDemand: () => {},
          forceOnDemand: true,
          isControlEnabled: true,
        },
        undefined,
        undefined,
        undefined,
        MEPState.AUTO
      );

      expect(mockEventsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.METRICS_ENHANCED,
            useOnDemandMetrics: true,
            onDemandType: 'dynamic_query',
          }),
        })
      );
    });

    it('makes series request to the transactions dataset', function () {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      TransactionsConfig.getSeriesRequest!(api, widget, 0, organization, pageFilters);

      expect(mockEventsStatsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.TRANSACTIONS,
          }),
        })
      );
    });

    it('makes series request to the metrics enhanced dataset', function () {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      TransactionsConfig.getSeriesRequest!(
        api,
        widget,
        0,
        organization,
        pageFilters,
        undefined,
        undefined,
        MEPState.AUTO
      );

      expect(mockEventsStatsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.METRICS_ENHANCED,
          }),
        })
      );
    });

    it('makes series request with on demand', function () {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      TransactionsConfig.getSeriesRequest!(
        api,
        widget,
        0,
        organization,
        pageFilters,
        {
          setForceOnDemand: () => {},
          forceOnDemand: true,
          isControlEnabled: true,
        },
        undefined,
        MEPState.AUTO
      );

      expect(mockEventsStatsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.METRICS_ENHANCED,
            onDemandType: 'dynamic_query',
            useOnDemandMetrics: true,
          }),
        })
      );
    });
  });
});
