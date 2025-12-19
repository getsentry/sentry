import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';

import {useFetchEventsTimeSeries} from './useFetchEventsTimeSeries';

jest.mock('sentry/utils/usePageFilters');

describe('useFetchEventsTimeSeries', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: {
          datetime: {
            period: '10d',
            start: null,
            end: null,
            utc: false,
          },
          environments: ['prod'],
          projects: [42],
        },
      })
    );
  });

  afterEach(() => {
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
