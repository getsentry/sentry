import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetricsTopNSeries} from 'sentry/views/insights/common/queries/useSpanMetricsTopNSeries';
import type {SpanMetricsProperty} from 'sentry/views/insights/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('useSpanMetricsTopNSeries', () => {
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

  it('rolls multi-axis top-n responses up into multiple series', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        '200': {
          data: [
            [1699907700, [{count: 117}]],
            [1699908000, [{count: 199}]],
          ],
        },
        '304': {
          data: [
            [1699907700, [{count: 12}]],
            [1699908000, [{count: 13}]],
          ],
        },
      },
    });

    const {result} = renderHook(
      ({filters, fields, topEvents, yAxis}) =>
        useSpanMetricsTopNSeries({
          search: MutableSearch.fromQueryObject(filters),
          fields,
          topEvents,
          yAxis,
        }),
      {
        wrapper: Wrapper,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
          },
          fields: ['span.status_code' as const, 'count()' as const],
          topEvents: 5,
          yAxis: ['count()'] as SpanMetricsProperty[],
        },
      }
    );

    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          query: `span.group:221aa7ebd216`,
          dataset: 'spansMetrics',
          statsPeriod: '10d',
          referrer: 'span-metrics-top-n-series',
          interval: '30m',
          topEvents: '5',
          field: ['span.status_code', 'count()'],
          yAxis: 'count()',
        }),
      })
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual({
      '200': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 117},
          {name: '2023-11-13T20:40:00+00:00', value: 199},
        ],
        seriesName: '200',
      },
      '304': {
        data: [
          {name: '2023-11-13T20:35:00+00:00', value: 12},
          {name: '2023-11-13T20:40:00+00:00', value: 13},
        ],
        seriesName: '304',
      },
    });
  });
});
