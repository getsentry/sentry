import type {ReactNode} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {MetricsProperty} from 'sentry/views/starfish/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useSpanMetrics', () => {
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

  jest.mocked(useLocation).mockReturnValue(
    LocationFixture({
      query: {statsPeriod: '10d'},
    })
  );

  jest.mocked(useOrganization).mockReturnValue(organization);

  it('respects the `enabled` prop', () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    const {result} = reactHooks.renderHook(
      ({fields, enabled}) => useSpanMetrics({fields, enabled}),
      {
        wrapper: Wrapper,
        initialProps: {
          fields: ['spm()'] as MetricsProperty[],
          enabled: false,
        },
      }
    );

    expect(result.current.isFetching).toEqual(false);
    expect(eventsRequest).not.toHaveBeenCalled();
  });

  it('queries for current selection', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.op': 'db',
            'spm()': 1486.3201388888888,
            'count()': 2140301,
          },
        ],
      },
    });

    const {result, waitFor} = reactHooks.renderHook(
      ({filters, fields, sorts, limit, cursor, referrer}) =>
        useSpanMetrics({
          search: MutableSearch.fromQueryObject(filters),
          fields,
          sorts,
          limit,
          cursor,
          referrer,
        }),
      {
        wrapper: Wrapper,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
            transaction: '/api/details',
            release: '0.0.1',
            environment: undefined,
          },
          fields: ['spm()'] as MetricsProperty[],
          sorts: [{field: 'spm()', kind: 'desc' as const}],
          limit: 10,
          referrer: 'api-spec',
          cursor: undefined,
        },
      }
    );

    expect(result.current.isLoading).toEqual(true);

    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: ['spm()'],
          per_page: 10,
          project: [],
          sort: '-spm()',
          query: `span.group:221aa7ebd216 transaction:/api/details release:0.0.1`,
          referrer: 'api-spec',
          statsPeriod: '10d',
        },
      })
    );

    await waitFor(() => expect(result.current.isLoading).toEqual(false));
    expect(result.current.data).toEqual([
      {
        'span.op': 'db',
        'spm()': 1486.3201388888888,
        'count()': 2140301,
      },
    ]);
  });
});
