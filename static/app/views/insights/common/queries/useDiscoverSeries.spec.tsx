import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {SpanProperty} from 'sentry/views/insights/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('useSpanSeries', () => {
  const organization = OrganizationFixture();

  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
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
    })
  );

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

    const {result} = renderHookWithProviders(
      ({filters, enabled}) =>
        useSpanSeries(
          {
            search: MutableSearch.fromQueryObject(filters),
            enabled,
          },
          'span-metrics-series'
        ),
      {
        organization,
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
        'epm()': {
          data: [
            [1699907700, [{count: 7810.2}]],
            [1699908000, [{count: 1216.8}]],
          ],
        },
      },
    });

    const {result} = renderHookWithProviders(
      ({filters, yAxis}) =>
        useSpanSeries(
          {search: MutableSearch.fromQueryObject(filters), yAxis},
          'span-metrics-series'
        ),
      {
        organization,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
            transaction: '/api/details',
            release: '0.0.1',
            'resource.render_blocking_status': 'blocking' as const,
            environment: undefined,
          },
          yAxis: ['epm()'] as SpanProperty[],
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
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          statsPeriod: '10d',
          referrer: 'span-metrics-series',
          interval: '30m',
          yAxis: 'epm()',
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

    const {rerender} = renderHookWithProviders(
      ({yAxis}) => useSpanSeries({yAxis}, 'span-metrics-series'),
      {
        organization,
        initialProps: {
          yAxis: ['avg(span.self_time)', 'epm()'] as SpanProperty[],
        },
      }
    );

    expect(eventsRequest).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          interval: '30m',
          yAxis: ['avg(span.self_time)', 'epm()'] as SpanProperty[],
        }),
      })
    );

    rerender({
      yAxis: ['p95(span.self_time)', 'epm()'] as SpanProperty[],
    });

    await waitFor(() =>
      expect(eventsRequest).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            interval: '1h',
            yAxis: ['p95(span.self_time)', 'epm()'] as SpanProperty[],
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
            'epm()': 'rate',
          },
          units: {
            'epm()': '1/minute',
          },
        },
      },
    });

    const {result} = renderHookWithProviders(
      ({yAxis}) => useSpanSeries({yAxis}, 'span-metrics-series'),
      {
        organization,
        initialProps: {
          yAxis: ['epm()'] as SpanProperty[],
        },
      }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual({
      'epm()': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 7810.2},
          {name: '2023-11-13T20:40:00+00:00', value: 1216.8},
        ],
        meta: {
          fields: {
            'epm()': 'rate',
          },
          units: {
            'epm()': '1/minute',
          },
        },
        seriesName: 'epm()',
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

    const {result} = renderHookWithProviders(
      ({yAxis}) => useSpanSeries({yAxis}, 'span-metrics-series'),
      {
        organization,
        initialProps: {
          yAxis: ['http_response_rate(3)', 'http_response_rate(4)'] as SpanProperty[],
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

    const {result} = renderHookWithProviders(
      ({yAxis}) => useSpanSeries({yAxis}, 'span-metrics-series'),
      {
        organization,
        initialProps: {
          yAxis: ['http_response_rate(3)', 'http_response_rate(4)'] as SpanProperty[],
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
