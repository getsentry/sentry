import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType} from 'sentry/views/dashboards/types';

describe('utils', () => {
  describe('getSeriesRequestData', () => {
    it('returns the correct request data for simple line chart timeseries', () => {
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            fields: ['count()', 'count_unique(user)'],
            aggregates: ['count()', 'count_unique(user)'],
            columns: [],
          }),
        ],
      });
      const pageFilters = PageFiltersFixture();
      const organization = OrganizationFixture();

      const requestData = getSeriesRequestData(
        widget,
        0,
        organization,
        pageFilters,
        DiscoverDatasets.ERRORS,
        'test-referrer'
      );
      expect(requestData).toEqual({
        // Baggage
        organization,
        dataset: DiscoverDatasets.ERRORS,
        referrer: 'test-referrer',

        // Meta settings on what should be included in the response
        includePrevious: false,
        includeAllArgs: true,
        partial: true,

        // Page filters
        environment: [],
        project: [],
        start: null,
        end: null,
        period: null,

        // Actual query data
        yAxis: ['count()', 'count_unique(user)'],
        query: 'tag:value',
        orderby: '',
        interval: '30m',
      });
    });

    it('returns the correct request data for line chart timeseries with grouping', () => {
      // This is essentially a TOP_N request because we group by the columns
      // and surface the top results
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            fields: ['title', 'count()'],
            aggregates: ['count()'],
            columns: ['title'],
          }),
        ],
      });
      const pageFilters = PageFiltersFixture();
      const organization = OrganizationFixture();

      const requestData = getSeriesRequestData(
        widget,
        0,
        organization,
        pageFilters,
        DiscoverDatasets.ERRORS,
        'test-referrer'
      );
      expect(requestData).toEqual({
        // Baggage
        organization,
        dataset: DiscoverDatasets.ERRORS,
        referrer: 'test-referrer',

        // Meta settings on what should be included in the response
        includePrevious: false,
        includeAllArgs: true,
        partial: true,
        excludeOther: false,

        // Page filters
        environment: [],
        project: [],
        start: null,
        end: null,
        period: null,

        // Actual query data
        field: ['title', 'count()'],
        yAxis: ['count()'],
        query: 'tag:value',
        orderby: '',
        interval: '30m',
        topEvents: 5,
      });
    });

    it('returns the correct request data for top-N chart timeseries with grouping', () => {
      // This is essentially a TOP_N request because we group by the columns
      // and surface the top results
      const widget = WidgetFixture({
        displayType: DisplayType.TOP_N,
        queries: [
          WidgetQueryFixture({
            fields: ['title', 'count()'],
            aggregates: ['count()'],
            columns: ['title'],
          }),
        ],
      });
      const pageFilters = PageFiltersFixture();
      const organization = OrganizationFixture();

      const requestData = getSeriesRequestData(
        widget,
        0,
        organization,
        pageFilters,
        DiscoverDatasets.ERRORS,
        'test-referrer'
      );
      expect(requestData).toEqual({
        // Baggage
        organization,
        dataset: DiscoverDatasets.ERRORS,
        referrer: 'test-referrer',

        // Meta settings on what should be included in the response
        includePrevious: false,
        includeAllArgs: true,
        partial: true,

        // Page filters
        environment: [],
        project: [],
        start: null,
        end: null,
        period: null,

        // Actual query data
        field: ['title', 'count()'],
        yAxis: 'count()',
        query: 'tag:value',
        interval: '30m',
        topEvents: 5,
      });
    });

    it('does not add the orderby field if it is in alias format but the query is not', () => {
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            fields: ['title', 'count_unique(user)'],
            aggregates: ['count_unique(user)'],
            columns: ['title'],
            orderby: 'count_unique_user',
          }),
        ],
      });
      const pageFilters = PageFiltersFixture();
      const organization = OrganizationFixture();

      const requestData = getSeriesRequestData(
        widget,
        0,
        organization,
        pageFilters,
        DiscoverDatasets.ERRORS,
        'test-referrer'
      );

      expect(requestData.field).not.toContain('count_unique_user');
    });

    it('adds the orderby to fields if it is not in fields, columns, or aggregates', () => {
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            fields: ['test'],
            aggregates: [],
            columns: ['test'],
            orderby: 'count_unique_user',
          }),
        ],
      });
      const pageFilters = PageFiltersFixture();
      const organization = OrganizationFixture();

      const requestData = getSeriesRequestData(
        widget,
        0,
        organization,
        pageFilters,
        DiscoverDatasets.ERRORS,
        'test-referrer'
      );

      expect(requestData.field).toContain('count_unique_user');
    });
  });
});
