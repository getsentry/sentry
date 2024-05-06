import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import type {SpanMetricsProperty} from 'sentry/views/starfish/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useSpanMetricsSeries', () => {
  const organization = OrganizationFixture();

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  it('respects the `enabled` prop', () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHook(
      ({filters, enabled}) =>
        useSpanMetricsSeries({
          search: MutableSearch.fromQueryObject(filters),
          enabled,
        }),
      {
        wrapper: Wrapper,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
          },
          enabled: false,
        },
      }
    );

    expect(result.current.isFetching).toEqual(false);
    expect(eventsRequest).not.toHaveBeenCalled();
  });

  it('queries for current selection', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'spm()': {
          data: [
            [1699907700, [{count: 7810.2}]],
            [1699908000, [{count: 1216.8}]],
          ],
        },
      },
    });

    const {result} = renderHook(
      ({filters, yAxis}) =>
        useSpanMetricsSeries({search: MutableSearch.fromQueryObject(filters), yAxis}),
      {
        wrapper: Wrapper,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
            transaction: '/api/details',
            release: '0.0.1',
            'resource.render_blocking_status': 'blocking' as const,
            environment: undefined,
          },
          yAxis: ['spm()'] as SpanMetricsProperty[],
        },
      }
    );

    expect(result.current.isLoading).toEqual(true);

    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          query: `span.group:221aa7ebd216 transaction:/api/details release:0.0.1 resource.render_blocking_status:blocking`,
          dataset: 'spansMetrics',
          statsPeriod: '10d',
          referrer: 'span-metrics-series',
          interval: '30m',
          yAxis: 'spm()',
        }),
      })
    );

    await waitFor(() => expect(result.current.isLoading).toEqual(false));
  });

  it('adjusts interval based on the yAxis', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    const {rerender} = renderHook(({yAxis}) => useSpanMetricsSeries({yAxis}), {
      wrapper: Wrapper,
      initialProps: {
        yAxis: ['avg(span.self_time)', 'spm()'] as SpanMetricsProperty[],
      },
    });

    expect(eventsRequest).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          interval: '30m',
          yAxis: ['avg(span.self_time)', 'spm()'] as SpanMetricsProperty[],
        }),
      })
    );

    rerender({
      yAxis: ['p95(span.self_time)', 'spm()'] as SpanMetricsProperty[],
    });

    await waitFor(() =>
      expect(eventsRequest).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            interval: '1h',
            yAxis: ['p95(span.self_time)', 'spm()'] as SpanMetricsProperty[],
          }),
        })
      )
    );
  });

  it('rolls single-axis responses up into a series', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [
          [1699907700, [{count: 7810.2}]],
          [1699908000, [{count: 1216.8}]],
        ],
      },
    });

    const {result} = renderHook(({yAxis}) => useSpanMetricsSeries({yAxis}), {
      wrapper: Wrapper,
      initialProps: {
        yAxis: ['spm()'] as SpanMetricsProperty[],
      },
    });

    await waitFor(() => expect(result.current.isLoading).toEqual(false));

    expect(result.current.data).toEqual({
      'spm()': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 7810.2},
          {name: '2023-11-13T20:40:00+00:00', value: 1216.8},
        ],
        seriesName: 'spm()',
      },
    });
  });

  it('rolls multi-axis responses up into multiple series', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'http_response_rate(3)': {
          data: [
            [1699907700, [{count: 10.1}]],
            [1699908000, [{count: 11.2}]],
          ],
        },
        'http_response_rate(4)': {
          data: [
            [1699907700, [{count: 12.6}]],
            [1699908000, [{count: 13.8}]],
          ],
        },
      },
    });

    const {result} = renderHook(({yAxis}) => useSpanMetricsSeries({yAxis}), {
      wrapper: Wrapper,
      initialProps: {
        yAxis: [
          'http_response_rate(3)',
          'http_response_rate(4)',
        ] as SpanMetricsProperty[],
      },
    });

    await waitFor(() => expect(result.current.isLoading).toEqual(false));

    expect(result.current.data).toEqual({
      'http_response_rate(3)': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 10.1},
          {name: '2023-11-13T20:40:00+00:00', value: 11.2},
        ],
        seriesName: 'http_response_rate(3)',
      },
      'http_response_rate(4)': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 12.6},
          {name: '2023-11-13T20:40:00+00:00', value: 13.8},
        ],
        seriesName: 'http_response_rate(4)',
      },
    });
  });
});
