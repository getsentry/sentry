import fetchMock from 'jest-fetch-mock';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type * as ApiNamespace from 'sentry/api';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {useFetchEventsTimeSeries} from './useFetchEventsTimeSeries';

describe('useFetchEventsTimeSeries', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: ['prod'],
        projects: [42],
      })
    );
  });

  afterEach(() => {
    PageFiltersStore.reset();
    jest.resetAllMocks();
  });

  it('fetches from `/events-timeseries`', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(() =>
      useFetchEventsTimeSeries(
        DiscoverDatasets.SPANS,
        {
          yAxis: 'epm()',
        },
        REFERRER
      )
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        method: 'GET',
        query: expect.anything(),
      })
    );
  });

  it('can be disabled', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(() =>
      useFetchEventsTimeSeries(
        DiscoverDatasets.SPANS,
        {
          yAxis: ['epm()'],
          enabled: false,
        },
        REFERRER
      )
    );

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(request).toHaveBeenCalledTimes(0);
  });

  it('refetches when transformations change and reuses the original cache when cleared', async () => {
    const original = {timeSeries: [TimeSeriesFixture({yAxis: 'count()'})]};
    const transformed = {timeSeries: [TimeSeriesFixture({yAxis: 'avg(span.duration)'})]};
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: original,
    });
    const initialProps: {transformations?: ReadonlyArray<readonly string[]>} = {};
    const {result, rerender} = renderHookWithProviders(
      ({transformations}: typeof initialProps) =>
        useFetchEventsTimeSeries(
          DiscoverDatasets.SPANS,
          {
            yAxis: ['count()', 'avg(span.duration)'],
            transformations,
          },
          REFERRER
        ),
      {initialProps}
    );

    await waitFor(() => expect(result.current.data).toEqual(original));

    const transformedRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      match: [
        MockApiClient.matchQuery({
          'transformations[1]': ['fill(locf)', 'smooth(sma,5)'],
        }),
      ],
      body: transformed,
    });
    rerender({transformations: [[], ['fill(locf)', 'smooth(sma,5)']]});

    await waitFor(() => expect(result.current.data).toEqual(transformed));
    expect(transformedRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          yAxis: ['count()', 'avg(span.duration)'],
          'transformations[1]': ['fill(locf)', 'smooth(sma,5)'],
        }),
      })
    );

    const {Client} = jest.requireActual<typeof ApiNamespace>('sentry/api');
    fetchMock.mockResponseOnce(JSON.stringify(transformed));
    await new Client().requestPromise('/organizations/org-slug/events-timeseries/', {
      query: transformedRequest.mock.lastCall![1].query,
    });
    const url = new URL(String(fetchMock.mock.lastCall![0]), 'https://sentry.io');
    expect(url.searchParams.getAll('transformations[1]')).toEqual([
      'fill(locf)',
      'smooth(sma,5)',
    ]);
    expect(url.searchParams.has('transformations[0]')).toBe(false);

    rerender({transformations: [[], []]});

    await waitFor(() => expect(result.current.data).toEqual(original));
    expect(request).toHaveBeenCalledTimes(1);
    expect(transformedRequest).toHaveBeenCalledTimes(1);
  });

  it('requires a referrer', () => {
    expect(() => {
      renderHookWithProviders(() =>
        useFetchEventsTimeSeries(
          DiscoverDatasets.SPANS,
          {
            yAxis: ['epm()'],
            enabled: false,
          },
          ''
        )
      );
    }).toThrow();
  });

  it('makes simple multi-series requests', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(() =>
      useFetchEventsTimeSeries(
        DiscoverDatasets.SPANS,
        {
          yAxis: 'p50(span.duration)',
          query: new MutableSearch('span.op:db*'),
        },
        REFERRER
      )
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        method: 'GET',
        query: {
          excludeOther: 0,
          partial: 1,
          referrer: 'test-query',
          dataset: 'spans',
          statsPeriod: '10d',
          yAxis: 'p50(span.duration)',
          environment: ['prod'],
          project: [42],
          interval: '1h',
          query: 'span.op:db*',
          sampling: 'NORMAL',
          caseInsensitive: undefined,
        },
      })
    );
  });

  it('allows overrides for default parameters', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(() =>
      useFetchEventsTimeSeries(
        DiscoverDatasets.SPANS,
        {
          yAxis: 'p50(span.duration)',
          interval: '2h',
          pageFilters: {
            environments: ['dev'],
            projects: [420],
            datetime: {
              start: '2020-01-01',
              end: '2020-01-02',
              period: null,
              utc: true,
            },
          },
        },
        REFERRER
      )
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        method: 'GET',
        query: {
          excludeOther: 0,
          partial: 1,
          referrer: 'test-query',
          dataset: 'spans',
          start: '2020-01-01T00:00:00.000',
          end: '2020-01-02T00:00:00.000',
          utc: 'true',
          yAxis: 'p50(span.duration)',
          environment: ['dev'],
          project: [420],
          interval: '2h',
          sampling: 'NORMAL',
          caseInsensitive: undefined,
        },
      })
    );
  });

  it('makes top N requests', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(() =>
      useFetchEventsTimeSeries(
        DiscoverDatasets.SPANS,
        {
          yAxis: 'p50(span.duration)',
          topEvents: 5,
          groupBy: ['span.category', 'transaction'],
          sort: {
            field: 'p50(span.duration)',
            kind: 'desc',
          },
        },
        REFERRER
      )
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        method: 'GET',
        query: {
          excludeOther: 0,
          partial: 1,
          referrer: 'test-query',
          dataset: 'spans',
          statsPeriod: '10d',
          yAxis: 'p50(span.duration)',
          environment: ['prod'],
          project: [42],
          interval: '1h',
          sampling: 'NORMAL',
          topEvents: 5,
          groupBy: ['span.category', 'transaction'],
          sort: '-p50(span.duration)',
          caseInsensitive: undefined,
        },
      })
    );
  });

  it('supports cross-event querying', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(() =>
      useFetchEventsTimeSeries(
        DiscoverDatasets.SPANS,
        {yAxis: 'epm()', logQuery: ['span.op:db*'], metricQuery: ['span.op:db*']},
        REFERRER
      )
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          logQuery: ['span.op:db*'],
          metricQuery: ['span.op:db*'],
        }),
      })
    );
  });
});

const REFERRER = 'test-query';
