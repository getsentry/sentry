import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {SpanMetricsProperty} from 'sentry/views/insights/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('useSpanMetricsSeries', () => {
  const organization = OrganizationFixture();

  function Wrapper({children}: {children?: ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext.Provider value={organization}>
          {children}
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  }

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

  it('respects the `enabled` prop', () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHook(
      ({filters, enabled}) =>
        useSpanMetricsSeries(
          {
            search: MutableSearch.fromQueryObject(filters),
            enabled,
          },
          'span-metrics-series'
        ),
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

    expect(result.current.isFetching).toBe(false);
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
        useSpanMetricsSeries(
          {search: MutableSearch.fromQueryObject(filters), yAxis},
          'span-metrics-series'
        ),
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

    expect(result.current.isPending).toBe(true);

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

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('adjusts interval based on the yAxis', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    const {rerender} = renderHook(
      ({yAxis}) => useSpanMetricsSeries({yAxis}, 'span-metrics-series'),
      {
        wrapper: Wrapper,
        initialProps: {
          yAxis: ['avg(span.self_time)', 'spm()'] as SpanMetricsProperty[],
        },
      }
    );

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
        meta: {
          fields: {
            'spm()': 'rate',
          },
          units: {
            'spm()': '1/minute',
          },
        },
      },
    });

    const {result} = renderHook(
      ({yAxis}) => useSpanMetricsSeries({yAxis}, 'span-metrics-series'),
      {
        wrapper: Wrapper,
        initialProps: {
          yAxis: ['spm()'] as SpanMetricsProperty[],
        },
      }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual({
      'spm()': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 7810.2},
          {name: '2023-11-13T20:40:00+00:00', value: 1216.8},
        ],
        meta: {
          fields: {
            'spm()': 'rate',
          },
          units: {
            'spm()': '1/minute',
          },
        },
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
          meta: {
            fields: {
              'http_response_rate(3)': 'rate',
            },
            units: {
              'http_response_rate(3)': '1/minute',
            },
          },
        },
        'http_response_rate(4)': {
          data: [
            [1699907700, [{count: 12.6}]],
            [1699908000, [{count: 13.8}]],
          ],
          meta: {
            fields: {
              'http_response_rate(4)': 'rate',
            },
            units: {
              'http_response_rate(4)': '1/minute',
            },
          },
        },
      },
    });

    const {result} = renderHook(
      ({yAxis}) => useSpanMetricsSeries({yAxis}, 'span-metrics-series'),
      {
        wrapper: Wrapper,
        initialProps: {
          yAxis: [
            'http_response_rate(3)',
            'http_response_rate(4)',
          ] as SpanMetricsProperty[],
        },
      }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual({
      'http_response_rate(3)': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 10.1},
          {name: '2023-11-13T20:40:00+00:00', value: 11.2},
        ],
        meta: {
          fields: {
            'http_response_rate(3)': 'rate',
          },
          units: {
            'http_response_rate(3)': '1/minute',
          },
        },
        seriesName: 'http_response_rate(3)',
      },
      'http_response_rate(4)': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 12.6},
          {name: '2023-11-13T20:40:00+00:00', value: 13.8},
        ],
        meta: {
          fields: {
            'http_response_rate(4)': 'rate',
          },
          units: {
            'http_response_rate(4)': '1/minute',
          },
        },
        seriesName: 'http_response_rate(4)',
      },
    });
  });

  it('returns a series for all requested yAxis even without data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHook(
      ({yAxis}) => useSpanMetricsSeries({yAxis}, 'span-metrics-series'),
      {
        wrapper: Wrapper,
        initialProps: {
          yAxis: [
            'http_response_rate(3)',
            'http_response_rate(4)',
          ] as SpanMetricsProperty[],
        },
      }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual({
      'http_response_rate(3)': {
        data: [],
        meta: undefined,
        seriesName: 'http_response_rate(3)',
      },
      'http_response_rate(4)': {
        data: [],
        meta: undefined,
        seriesName: 'http_response_rate(4)',
      },
    });
  });
});
