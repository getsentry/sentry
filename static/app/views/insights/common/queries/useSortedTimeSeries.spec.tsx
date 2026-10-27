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

  it('selects raw and smoothed values separately for each group', async () => {
    const response = {
      timeSeries: ['first', 'second'].flatMap(group =>
        [10, 20].map(value =>
          TimeSeriesFixture({
            yAxis: 'count()',
            groupBy: [{key: 'group', value: group}],
            values: [{timestamp: 1, value}],
          })
        )
      ),
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
          transformations: [[], ['smooth(sma,5)']],
        },
        'test-query',
        DiscoverDatasets.SPANS
      )
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTimeSeriesForQuery(result.current.data, 'count()')).toEqual([
      {...response.timeSeries[0], requestedTransformations: []},
      {...response.timeSeries[2], requestedTransformations: []},
    ]);
    expect(
      getTimeSeriesForQuery(result.current.data, 'count()', ['smooth(sma,5)'])
    ).toEqual([
      {...response.timeSeries[1], requestedTransformations: ['smooth(sma,5)']},
      {...response.timeSeries[3], requestedTransformations: ['smooth(sma,5)']},
    ]);
    expect(response.timeSeries[0]).not.toHaveProperty('requestedTransformations');
  });

  it('uses unannotated series when transformations are disabled', () => {
    const series = TimeSeriesFixture({yAxis: 'count()'});
    expect(
      getTimeSeriesForQuery({'count()': [series]}, 'count()', ['smooth(sma,5)'])
    ).toEqual([series]);
  });
});
