import type {ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useFetchEventsTimeSeries} from './useFetchEventsTimeSeries';

describe('useFetchEventsTimeSeries', () => {
  const organization = OrganizationFixture();

  function Wrapper({children}: {children?: ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  }

  it('fetches from `/events-timeseries`', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHook(
      () =>
        useFetchEventsTimeSeries(
          {
            yAxis: 'epm()',
          },
          DiscoverDatasets.SPANS,
          REFERRER
        ),
      {
        wrapper: Wrapper,
      }
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
          yAxis: 'epm()',
        },
      })
    );
  });

  it('fetches multiple Y axes', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHook(
      () =>
        useFetchEventsTimeSeries(
          {
            yAxis: ['count(span.duration)', 'p50(span.duration)'],
          },
          DiscoverDatasets.SPANS,
          REFERRER
        ),
      {
        wrapper: Wrapper,
      }
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
          yAxis: ['count(span.duration)', 'p50(span.duration)'],
        },
      })
    );
  });

  it('can be disabled', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHook(
      () =>
        useFetchEventsTimeSeries(
          {
            yAxis: ['epm()'],
            enabled: false,
          },
          DiscoverDatasets.SPANS,
          REFERRER
        ),
      {
        wrapper: Wrapper,
      }
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
            {
              yAxis: ['epm()'],
              enabled: false,
            },
            DiscoverDatasets.SPANS,
            ''
          ),
        {
          wrapper: Wrapper,
        }
      );
    }).toThrow();
  });
});

const REFERRER = 'test-query';
