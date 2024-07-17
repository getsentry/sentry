import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';

describe('TransactionsConfig', function () {
  describe('getEventsRequest', function () {
    let api, organization, mockEventsRequest;

    beforeEach(function () {
      MockApiClient.clearMockResponses();

      api = new MockApiClient();
      organization = OrganizationFixture();

      mockEventsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          data: [],
        },
      });
    });

    it('makes a request to the metrics enhanced dataset', function () {
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
            dataset: DiscoverDatasets.METRICS_ENHANCED,
          }),
        })
      );
    });
  });
});
