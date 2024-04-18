import type {ReactNode} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import type {IndexedProperty} from 'sentry/views/starfish/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useIndexedSpans', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('respects the `enabled` prop', () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    const {result} = renderHook(
      ({fields, enabled}) => useIndexedSpans({fields, enabled}),
      {
        wrapper: Wrapper,
        initialProps: {
          fields: ['span.description'] as IndexedProperty[],
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
            'span.group': '221aa7ebd216',
            'span.op': 'db',
            'span.description': 'SELECT * FROM users;',
          },
        ],
        meta: {
          fields: {
            'span.description': 'string',
            'span.op': 'string',
            'span.group': 'string',
          },
        },
      },
    });

    const {result} = renderHook(
      ({filters, fields, sorts, limit, cursor, referrer}) =>
        useIndexedSpans({
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
            'measurements.inp': ['<50', '>0'],
            transaction: '/api/details',
            release: '0.0.1',
          },
          fields: ['span.op', 'span.group', 'span.description'] as IndexedProperty[],
          sorts: [{field: 'span.group', kind: 'desc' as const}],
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
          dataset: 'spansIndexed',
          environment: [],
          field: ['span.op', 'span.group', 'span.description'],
          per_page: 10,
          project: [],
          sort: '-span.group',
          query: `span.group:221aa7ebd216 measurements.inp:<50 measurements.inp:>0 transaction:/api/details release:0.0.1`,
          referrer: 'api-spec',
          statsPeriod: '10d',
        },
      })
    );

    await waitFor(() => expect(result.current.isLoading).toEqual(false));
    expect(result.current.data).toEqual([
      {
        'span.group': '221aa7ebd216',
        'span.op': 'db',
        'span.description': 'SELECT * FROM users;',
      },
    ]);
  });
});
