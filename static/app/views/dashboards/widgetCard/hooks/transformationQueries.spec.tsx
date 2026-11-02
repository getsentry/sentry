import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {useLogsSeriesQuery} from 'sentry/views/dashboards/widgetCard/hooks/useLogsWidgetQuery';
import {useSpansSeriesQuery} from 'sentry/views/dashboards/widgetCard/hooks/useSpansWidgetQuery';
import {useTraceMetricsSeriesQuery} from 'sentry/views/dashboards/widgetCard/hooks/useTraceMetricsWidgetQuery';

describe('dashboard transformation queries', () => {
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it.each([
    {
      widgetType: WidgetType.SPANS,
      useSeriesQuery: useSpansSeriesQuery,
      aggregate: 'count()',
      expectedSeriesNames: [
        '["count()",["fill(locf)"]]',
        '["count()",["smooth(sma,5)","fill(zero)"]]',
      ],
    },
    {
      widgetType: WidgetType.LOGS,
      useSeriesQuery: useLogsSeriesQuery,
      aggregate: 'count()',
      expectedSeriesNames: [
        '["count()",["fill(locf)"]]',
        '["count()",["smooth(sma,5)","fill(zero)"]]',
      ],
    },
    {
      widgetType: WidgetType.TRACEMETRICS,
      useSeriesQuery: useTraceMetricsSeriesQuery,
      aggregate: 'sum(value,example_metric,counter,none)',
      expectedSeriesNames: [
        '["sum(example_metric)",["fill(locf)"]]',
        '["sum(example_metric)",["smooth(sma,5)","fill(zero)"]]',
      ],
    },
  ])(
    'requests and returns independent transformed $widgetType series',
    async ({widgetType, useSeriesQuery, aggregate, expectedSeriesNames}) => {
      const organization = OrganizationFixture({
        features: ['explore-interpolation-and-smoothing'],
      });
      const widget = WidgetFixture({
        widgetType,
        displayType: DisplayType.LINE,
        queries: [
          WidgetQueryFixture({
            aggregates: [aggregate, aggregate],
            columns: [],
            transformations: {'0': ['fill(locf)'], '1': ['smooth(sma,5)', 'fill(zero)']},
          }),
        ],
      });
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [
            TimeSeriesFixture({yAxis: aggregate}),
            TimeSeriesFixture({yAxis: aggregate}),
          ],
        },
      });
      const {result} = renderHookWithProviders(() =>
        useSeriesQuery({widget, organization, pageFilters, enabled: true})
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.timeseriesResults?.map(series => series.seriesName)).toEqual(
        expectedSeriesNames
      );
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: [aggregate, aggregate],
            'transformations[0]': ['fill(locf)'],
            'transformations[1]': ['smooth(sma,5)', 'fill(zero)'],
          }),
        })
      );
    }
  );

  it('reindexes transformations after invalid conditional aggregates are removed', async () => {
    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
      displayType: DisplayType.LINE,
      queries: [
        WidgetQueryFixture({
          aggregates: ['avg_if(``,span.duration)', 'count()', 'count()'],
          columns: [],
          orderby: '',
          transformations: {
            '0': ['fill(linear)'],
            '1': ['fill(zero)'],
            '2': ['smooth(sma,3)'],
          },
        }),
      ],
    });
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [TimeSeriesFixture({yAxis: 'count()'})],
      },
    });
    const {result} = renderHookWithProviders(() =>
      useSpansSeriesQuery({
        widget,
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
        pageFilters,
        enabled: true,
      })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: ['count()', 'count()'],
          'transformations[0]': ['fill(zero)'],
          'transformations[1]': ['smooth(sma,3)'],
        }),
      })
    );
  });
});
