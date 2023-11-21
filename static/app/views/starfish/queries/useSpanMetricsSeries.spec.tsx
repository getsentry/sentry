import {ReactNode} from 'react';
import {Organization} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useSpanMetricsSeries', () => {
  const organization = Organization();

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

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      ({filters, yAxis}) => useSpanMetricsSeries(filters, yAxis),
      {
        wrapper: Wrapper,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
            transaction: '/api/details',
            release: '0.0.1',
            'resource.render_blocking_status': 'blocking' as const,
          },
          yAxis: ['spm()'],
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

    await waitForNextUpdate();

    expect(result.current.isLoading).toEqual(false);
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

  it('adjusts interval based on the yAxis', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    const {rerender, waitForNextUpdate} = reactHooks.renderHook(
      ({yAxis}) => useSpanMetricsSeries({}, yAxis),
      {
        wrapper: Wrapper,
        initialProps: {
          yAxis: ['avg(span.self_time)', 'spm()'],
        },
      }
    );

    expect(eventsRequest).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          interval: '30m',
          yAxis: ['avg(span.self_time)', 'spm()'],
        }),
      })
    );

    rerender({
      yAxis: ['p95(span.self_time)', 'spm()'],
    });

    expect(eventsRequest).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          interval: '1h',
          yAxis: ['p95(span.self_time)', 'spm()'],
        }),
      })
    );

    await waitForNextUpdate();
  });
});
