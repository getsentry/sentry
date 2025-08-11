import type {ReactNode} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanProperty} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>
      <OrganizationContext value={OrganizationFixture()}>{children}</OrganizationContext>
    </QueryClientProvider>
  );
}

describe('useDiscover', () => {
  describe('useSpans', () => {
    const organization = OrganizationFixture();

    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

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
        ({fields, enabled}) => useSpans({fields, enabled}, 'span-metrics-series'),
        {
          wrapper: Wrapper,
          initialProps: {
            fields: ['epm()'] as SpanProperty[],
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
              'epm()': 1486.3201388888888,
              'count()': 2140301,
            },
          ],
        },
      });

      const {result} = renderHook(
        ({filters, fields, sorts, limit, cursor, referrer}) =>
          useSpans(
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
            fields: ['epm()'] as SpanProperty[],
            sorts: [{field: 'epm()', kind: 'desc' as const}],
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
            dataset: 'spans',
            environment: [],
            field: ['epm()'],
            per_page: 10,
            project: [],
            sort: '-epm()',
            query: `span.group:221aa7ebd216 transaction:/api/details release:0.0.1`,
            referrer: 'api-spec',
            sampling: SAMPLING_MODE.NORMAL,
            statsPeriod: '10d',
          },
        })
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(result.current.data).toEqual([
        {
          'span.op': 'db',
          'epm()': 1486.3201388888888,
          'count()': 2140301,
        },
      ]);
    });
  });

  describe('useSpanIndexed', () => {
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
        ({fields, enabled}) => useSpans({fields, enabled}, 'referrer'),
        {
          wrapper: Wrapper,
          initialProps: {
            fields: [SpanFields.SPAN_DESCRIPTION] as SpanProperty[],
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
          useSpans(
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
              SpanFields.SPAN_OP,
              SpanFields.SPAN_GROUP,
              SpanFields.SPAN_DESCRIPTION,
            ] as SpanProperty[],
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
            dataset: 'spans',
            sampling: SAMPLING_MODE.NORMAL,
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
