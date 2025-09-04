import type {ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useFetchEventsTimeSeries} from './useFetchEventsTimeSeries';

jest.mock('sentry/utils/usePageFilters');

describe('useFetchEventsTimeSeries', () => {
  const organization = OrganizationFixture();

  function Wrapper({children}: {children?: ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  }

  const hookOptions = {
    wrapper: Wrapper,
  };

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

    const {result} = renderHook(
      () =>
        useFetchEventsTimeSeries(
          DiscoverDatasets.SPANS,
          {
            yAxis: 'epm()',
          },
          REFERRER
        ),
      hookOptions
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

    const {result} = renderHook(
      () =>
        useFetchEventsTimeSeries(
          DiscoverDatasets.SPANS,
          {
            yAxis: ['epm()'],
            enabled: false,
          },
          REFERRER
        ),
      hookOptions
    );

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(request).toHaveBeenCalledTimes(0);
  });

  it('requires a referrer', () => {
    expect(() => {
      renderHook(
        () =>
          useFetchEventsTimeSeries(
            DiscoverDatasets.SPANS,
            {
              yAxis: ['epm()'],
              enabled: false,
            },
            ''
          ),
        {
          wrapper: Wrapper,
        }
      );
    }).toThrow();
  });

  it('makes simple multi-series requests', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHook(
      () =>
        useFetchEventsTimeSeries(
          DiscoverDatasets.SPANS,
          {
            yAxis: 'p50(span.duration)',
            query: new MutableSearch('span.op:db*'),
          },
          REFERRER
        ),
      hookOptions
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

    const {result} = renderHook(
      () =>
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
        ),
      hookOptions
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

    const {result} = renderHook(
      () =>
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
        ),
      hookOptions
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
        },
      })
    );
  });
});

const REFERRER = 'test-query';
