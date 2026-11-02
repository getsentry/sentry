import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  getSeriesRequestData,
  getTimeseriesRequestQuery,
} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

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

    describe('equation orderby handling for trace metrics', () => {
      it('passes full equation orderby through and adds it to fields for TRACEMETRICS', () => {
        const widget = WidgetFixture({
          displayType: DisplayType.LINE,
          queries: [
            WidgetQueryFixture({
              fields: [
                'project',
                'avg(value,test_metric,millisecond,none)',
                'equation|avg(value,test_metric,millisecond,none) / 2',
              ],
              aggregates: ['avg(value,test_metric,millisecond,none)'],
              columns: ['project'],
              orderby: '-equation|avg(value,test_metric,millisecond,none) / 2',
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
          DiscoverDatasets.TRACEMETRICS,
          'test-referrer'
        );

        expect(requestData.orderby).toBe(
          '-equation|avg(value,test_metric,millisecond,none) / 2'
        );
        expect(requestData.field).toContain(
          'equation|avg(value,test_metric,millisecond,none) / 2'
        );
      });

      it('resolves equation alias orderby to full equation form for TRACEMETRICS', () => {
        const widget = WidgetFixture({
          displayType: DisplayType.LINE,
          queries: [
            WidgetQueryFixture({
              fields: [
                'project',
                'avg(value,test_metric,millisecond,none)',
                'equation|avg(value,test_metric,millisecond,none) / 2',
              ],
              aggregates: ['avg(value,test_metric,millisecond,none)'],
              columns: ['project'],
              orderby: '-equation[0]',
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
          DiscoverDatasets.TRACEMETRICS,
          'test-referrer'
        );

        expect(requestData.orderby).toBe(
          '-equation|avg(value,test_metric,millisecond,none) / 2'
        );
      });

      it('resolves ascending equation alias orderby for TRACEMETRICS', () => {
        const widget = WidgetFixture({
          displayType: DisplayType.LINE,
          queries: [
            WidgetQueryFixture({
              fields: [
                'project',
                'avg(value,test_metric,millisecond,none)',
                'equation|avg(value,test_metric,millisecond,none) / 2',
              ],
              aggregates: ['avg(value,test_metric,millisecond,none)'],
              columns: ['project'],
              orderby: 'equation[0]',
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
          DiscoverDatasets.TRACEMETRICS,
          'test-referrer'
        );

        expect(requestData.orderby).toBe(
          'equation|avg(value,test_metric,millisecond,none) / 2'
        );
      });

      it('converts full equation orderby to alias format for non-EAP datasets', () => {
        const widget = WidgetFixture({
          displayType: DisplayType.LINE,
          queries: [
            WidgetQueryFixture({
              fields: ['project', 'count()', 'equation|count() / 2'],
              aggregates: ['count()'],
              columns: ['project'],
              orderby: '-equation|count() / 2',
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

        // Non-EAP datasets convert to equation[N] alias format
        // The index is based on the number of equations in aggregates (0 here)
        expect(requestData.orderby).toBe('-equation[0]');
        expect(requestData.field).toContain('equation|count() / 2');
      });
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

  describe('getTimeseriesRequestQuery', () => {
    it('sends positional transformations and keeps duplicate y-axes', () => {
      const widget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            aggregates: ['count()', 'count()'],
            columns: [],
            transformations: {'1': ['fill(zero)']},
          }),
        ],
      });

      const params = getTimeseriesRequestQuery(
        widget,
        0,
        PageFiltersFixture(),
        DiscoverDatasets.SPANS,
        {
          organization: OrganizationFixture({
            features: ['explore-interpolation-and-smoothing'],
          }),
        }
      );

      expect(params.yAxis).toEqual(['count()', 'count()']);
      expect(params).toHaveProperty(['transformations[1]'], ['fill(zero)']);
    });

    it('sends pipelines for equation y-axes', () => {
      const widget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            aggregates: ['count()', 'equation|count() * 2'],
            columns: [],
            transformations: {'1': ['smooth(sma,3)']},
          }),
        ],
      });

      const params = getTimeseriesRequestQuery(
        widget,
        0,
        PageFiltersFixture(),
        DiscoverDatasets.SPANS,
        {
          organization: OrganizationFixture({
            features: ['explore-interpolation-and-smoothing'],
          }),
        }
      );

      expect(params.yAxis).toEqual(['count()', 'equation|count() * 2']);
      expect(params).toHaveProperty(['transformations[1]'], ['smooth(sma,3)']);
    });

    it('drops repeated y-axes only when their pipelines also match', () => {
      const widget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            aggregates: ['count()', 'count()', 'count()', 'count()'],
            columns: [],
            transformations: {'2': ['fill(zero)'], '3': ['fill(zero)']},
          }),
        ],
      });

      const params = getTimeseriesRequestQuery(
        widget,
        0,
        PageFiltersFixture(),
        DiscoverDatasets.SPANS,
        {
          organization: OrganizationFixture({
            features: ['explore-interpolation-and-smoothing'],
          }),
        }
      );

      expect(params.yAxis).toEqual(['count()', 'count()']);
      expect(params).toHaveProperty(['transformations[1]'], ['fill(zero)']);
      expect(params).not.toHaveProperty(['transformations[2]']);
    });

    it.each([
      {displayType: DisplayType.LINE, features: []},
      {displayType: DisplayType.TABLE, features: ['explore-interpolation-and-smoothing']},
      {displayType: DisplayType.TOP_N, features: ['explore-interpolation-and-smoothing']},
    ])(
      'omits transformations for $displayType with features $features',
      ({displayType, features}) => {
        const widget = WidgetFixture({
          widgetType: WidgetType.SPANS,
          displayType,
          queries: [
            WidgetQueryFixture({
              aggregates: ['count()'],
              transformations: {'0': ['fill(zero)']},
            }),
          ],
        });

        const params = getTimeseriesRequestQuery(
          widget,
          0,
          PageFiltersFixture(),
          DiscoverDatasets.SPANS,
          {organization: OrganizationFixture({features})}
        );

        expect(params.yAxis).toEqual(['count()']);
        expect(params).not.toHaveProperty(['transformations[0]']);
      }
    );

    it('builds events-timeseries params for a grouped query', () => {
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        limit: 5,
        queries: [
          WidgetQueryFixture({
            fields: ['transaction', 'count()', 'count()'],
            aggregates: ['count()', 'count()'],
            columns: ['transaction'],
            orderby: '-count()',
          }),
        ],
      });

      const params = getTimeseriesRequestQuery(
        widget,
        0,
        PageFiltersFixture(),
        DiscoverDatasets.SPANS,
        {referrer: 'test-referrer', sampling: 'NORMAL'}
      );

      expect(params).toEqual({
        interval: '30m',
        project: [],
        environment: [],
        query: 'tag:value',
        yAxis: ['count()'],
        groupBy: ['transaction', 'count()', 'count()'],
        field: ['transaction', 'count()', 'count()'],
        sort: '-count()',
        topEvents: 5,
        excludeOther: '1',
        referrer: 'test-referrer',
        dataset: DiscoverDatasets.SPANS,
        sampling: 'NORMAL',
      });
    });

    it('omits grouping params and the sort for an ungrouped query', () => {
      const widget = WidgetFixture({
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            orderby: '',
          }),
        ],
      });

      const params = getTimeseriesRequestQuery(
        widget,
        0,
        PageFiltersFixture(),
        DiscoverDatasets.ERRORS
      );

      expect(params.yAxis).toEqual(['count()']);
      expect(params.groupBy).toBeUndefined();
      expect(params.field).toBeUndefined();
      expect(params.sort).toBeUndefined();
      expect(params.topEvents).toBeUndefined();
      expect(params.excludeOther).toBeUndefined();
    });

    it('formats absolute dates and uses the widget interval', () => {
      const widget = WidgetFixture({displayType: DisplayType.LINE});
      const pageFilters = PageFiltersFixture({
        datetime: {
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-02T00:00:00Z'),
          period: null,
          utc: true,
        },
      });

      const params = getTimeseriesRequestQuery(
        widget,
        0,
        pageFilters,
        DiscoverDatasets.ERRORS,
        {widgetInterval: '1h'}
      );

      expect(params).toEqual(
        expect.objectContaining({
          interval: '1h',
          start: '2024-01-01T00:00:00',
          end: '2024-01-02T00:00:00',
        })
      );
      expect(params).not.toHaveProperty('statsPeriod');
    });
  });
});
