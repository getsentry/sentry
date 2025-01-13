import type {ReactNode} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useSpanMetrics,
  useSpansIndexed,
} from 'sentry/views/insights/common/queries/useDiscover';
import {
  SpanIndexedField,
  type SpanIndexedProperty,
  type SpanMetricsProperty,
} from 'sentry/views/insights/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>
      <OrganizationContext.Provider value={OrganizationFixture()}>
        {children}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('useDiscover', () => {
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

    it('respects the `enabled` prop', () => {
      const eventsRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        method: 'GET',
        body: {data: []},
      });

      const {result} = renderHook(
        ({fields, enabled}) => useSpanMetrics({fields, enabled}, 'span-metrics-series'),
        {
          wrapper: Wrapper,
          initialProps: {
            fields: ['spm()'] as SpanMetricsProperty[],
            enabled: false,
          },
        }
      );

      expect(result.current.isFetching).toBe(false);
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

      const {result} = renderHook(
        ({filters, fields, sorts, limit, cursor, referrer}) =>
          useSpanMetrics(
            {
              search: MutableSearch.fromQueryObject(filters),
              fields,
              sorts,
              limit,
              cursor,
            },
            referrer
          ),
        {
          wrapper: Wrapper,
          initialProps: {
            filters: {
              'span.group': '221aa7ebd216',
              transaction: '/api/details',
              release: '0.0.1',
              environment: undefined,
            },
            fields: ['spm()'] as SpanMetricsProperty[],
            sorts: [{field: 'spm()', kind: 'desc' as const}],
            limit: 10,
            referrer: 'api-spec',
            cursor: undefined,
          },
        }
      );

      expect(result.current.isPending).toBe(true);

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

      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(result.current.data).toEqual([
        {
          'span.op': 'db',
          'spm()': 1486.3201388888888,
          'count()': 2140301,
        },
      ]);
    });
  });

  describe('useSpanIndexed', () => {
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
        ({fields, enabled}) => useSpansIndexed({fields, enabled}, 'referrer'),
        {
          wrapper: Wrapper,
          initialProps: {
            fields: [SpanIndexedField.SPAN_DESCRIPTION] as SpanIndexedProperty[],
            enabled: false,
          },
        }
      );

      expect(result.current.isFetching).toBe(false);
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
          useSpansIndexed(
            {
              search: MutableSearch.fromQueryObject(filters),
              fields,
              sorts,
              limit,
              cursor,
            },
            referrer
          ),
        {
          wrapper: Wrapper,
          initialProps: {
            filters: {
              'span.group': '221aa7ebd216',
              'measurements.inp': ['<50', '>0'],
              transaction: '/api/details',
              release: '0.0.1',
            },
            fields: [
              SpanIndexedField.SPAN_OP,
              SpanIndexedField.SPAN_GROUP,
              SpanIndexedField.SPAN_DESCRIPTION,
            ] as SpanIndexedProperty[],
            sorts: [{field: 'span.group', kind: 'desc' as const}],
            limit: 10,
            referrer: 'api-spec',
            cursor: undefined,
          },
        }
      );

      expect(result.current.isPending).toBe(true);

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

      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(result.current.data).toEqual([
        {
          'span.group': '221aa7ebd216',
          'span.op': 'db',
          'span.description': 'SELECT * FROM users;',
        },
      ]);
    });
  });
});
