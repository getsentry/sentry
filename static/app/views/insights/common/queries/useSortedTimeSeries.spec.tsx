import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

describe('useSortedTimeSeries', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('keeps grouped duplicate axes separate by their ordered transformations', async () => {
    const response = {
      timeSeries: [
        ...[11, 22, 33].map(value =>
          TimeSeriesFixture({
            yAxis: 'count()',
            groupBy: [{key: 'group', value: 'second'}],
            values: [{timestamp: 1, value}],
          })
        ),
        ...[1, 2, 3].map(value =>
          TimeSeriesFixture({
            yAxis: 'count()',
            groupBy: [{key: 'group', value: 'first'}],
            values: [{timestamp: 1, value}],
          })
        ),
      ],
    };
    for (const series of response.timeSeries) {
      Object.freeze(series.values);
      Object.freeze(series);
    }
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: response,
    });

    const {result} = renderHookWithProviders(() =>
      useSortedTimeSeries(
        {
          enabled: true,
          yAxis: ['count()', 'count()', 'count()'],
          transformations: [['fill(locf)', 'smooth(sma,5)'], ['smooth(sma,5)'], []],
        },
        'test-query',
        DiscoverDatasets.SPANS
      )
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      getTimeSeriesForQuery(result.current.data, 'count()', [
        'fill(locf)',
        'smooth(sma,5)',
      ]).map(series => series.values[0]!.value)
    ).toEqual([11, 1]);
    expect(
      getTimeSeriesForQuery(result.current.data, 'count()', ['smooth(sma,5)']).map(
        series => series.values[0]!.value
      )
    ).toEqual([22, 2]);
    expect(
      getTimeSeriesForQuery(result.current.data, 'count()').map(
        series => series.values[0]!.value
      )
    ).toEqual([33, 3]);
    expect(
      getTimeSeriesForQuery(result.current.data, 'count()', [
        'smooth(sma,5)',
        'fill(locf)',
      ])
    ).toEqual([]);
    expect(response.timeSeries[0]).not.toHaveProperty('requestedTransformations');
  });

  it('uses raw series for stored transformations when the feature is off', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          TimeSeriesFixture({yAxis: 'count()', values: [{timestamp: 1, value: 7}]}),
        ],
      },
    });
    const {result} = renderHookWithProviders(() =>
      useSortedTimeSeries(
        {enabled: true, yAxis: ['count()']},
        'test-query',
        DiscoverDatasets.SPANS
      )
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      getTimeSeriesForQuery(result.current.data, 'count()', ['fill(zero)']).map(
        series => series.values[0]!.value
      )
    ).toEqual([7]);
  });

  it.each([false, true])(
    'preserves empty series and Other groups (%s)',
    async isOther => {
      const response = {
        timeSeries: [
          TimeSeriesFixture({yAxis: 'count()', groupBy: null, values: []}),
          TimeSeriesFixture({
            yAxis: 'count()',
            groupBy: null,
            values: [{timestamp: 1, value: 17}],
          }),
        ].map(series => ({...series, meta: {...series.meta, isOther}})),
      };
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: response,
      });
      const {result} = renderHookWithProviders(() =>
        useSortedTimeSeries(
          {
            enabled: true,
            yAxis: ['count()', 'count()'],
            transformations: [['fill(locf)'], []],
          },
          'test-query',
          DiscoverDatasets.SPANS
        )
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(
        getTimeSeriesForQuery(result.current.data, 'count()', ['fill(locf)'])
      ).toEqual([{...response.timeSeries[0], requestedTransformations: ['fill(locf)']}]);
      expect(getTimeSeriesForQuery(result.current.data, 'count()')).toEqual([
        {...response.timeSeries[1], requestedTransformations: []},
      ]);
    }
  );

  it.each([['count()'], ['avg(span.duration)', 'count()']])(
    'rejects a response that cannot be matched to the request axes %j',
    async (...axes) => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {timeSeries: axes.map(yAxis => TimeSeriesFixture({yAxis}))},
      });
      const {result} = renderHookWithProviders(() =>
        useSortedTimeSeries(
          {
            enabled: true,
            yAxis: ['count()', 'avg(span.duration)'],
            transformations: [['fill(locf)'], []],
          },
          'test-query',
          DiscoverDatasets.SPANS
        )
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe(
        'Time series response did not match the requested axes.'
      );
    }
  );
});
