import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {getHistoricalDatetime, useExploreAnomalies} from './useExploreAnomalies';

const organization = OrganizationFixture();

describe('getHistoricalDatetime', () => {
  it.each([
    ['1h', '678h'],
    ['24h', '29d'],
    ['3d', '31d'],
    ['7d', '28d'],
  ])('maps a %s range to %s of history', (period, expected) => {
    expect(getHistoricalDatetime({period, start: null, end: null, utc: false})).toEqual({
      period: expected,
      start: null,
      end: null,
      utc: false,
    });
  });

  it('reaches back from the end of an absolute range', () => {
    expect(
      getHistoricalDatetime({
        period: null,
        start: '2026-11-01T00:00:00',
        end: '2026-11-03T00:00:00',
        utc: true,
      })
    ).toEqual({
      period: null,
      start: '2026-10-03T00:00:00',
      end: '2026-11-03T00:00:00',
      utc: true,
    });
  });
});

describe('useExploreAnomalies', () => {
  const visualize = new VisualizeFunction('count(span.duration)');

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {period: '24h', start: null, end: null, utc: false},
        projects: [2],
      })
    );
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('re-runs the chart query over the historical range without a group by', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [TimeSeriesFixture({yAxis: 'count(span.duration)'})],
        meta: {dataset: 'spans', start: 0, end: 0},
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useExploreAnomalies({
          enabled: true,
          extrapolate: true,
          isMainChartLoaded: true,
          query: 'span.op:db',
          queryExtras: {caseInsensitive: true},
          visualize,
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.historicalTimeSeries).toHaveLength(1));
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '29d',
          yAxis: ['count(span.duration)'],
          groupBy: [],
          query: 'span.op:db',
          caseInsensitive: 1,
          project: [2],
        }),
      })
    );
    expect(request.mock.calls[0][1].query.topEvents).toBeUndefined();
  });

  it.each([
    ['the toggle is off', {enabled: false, isMainChartLoaded: true}],
    ['the main chart is loading', {enabled: true, isMainChartLoaded: false}],
  ])('does not fetch when %s', (_, flags) => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: [], meta: {dataset: 'spans', start: 0, end: 0}},
    });

    renderHookWithProviders(
      () =>
        useExploreAnomalies({
          ...flags,
          extrapolate: true,
          query: '',
          visualize,
        }),
      {organization}
    );

    expect(request).not.toHaveBeenCalled();
  });
});
