import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanSamples} from 'sentry/views/insights/http/queries/useSpanSamples';
import {SpanIndexedField, type SpanIndexedProperty} from 'sentry/views/insights/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/usePageFilters');

describe('useSpanSamples', () => {
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
      environments: ['prod'],
      projects: [],
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('respects the `enabled` prop', () => {
    const request = MockApiClient.addMockResponse({
      url: `/api/0/organizations/${organization.slug}/spans-samples/`,
      method: 'GET',
      body: {data: []},
    });

    const {result} = renderHook(
      ({fields, enabled}) => useSpanSamples({fields, enabled}),
      {
        wrapper: Wrapper,
        initialProps: {
          fields: [
            SpanIndexedField.TRANSACTION_ID,
            SpanIndexedField.SPAN_ID,
          ] as SpanIndexedProperty[],
          enabled: false,
        },
      }
    );

    expect(result.current.isFetching).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('queries for current selection', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/api/0/organizations/${organization.slug}/spans-samples/`,
      method: 'GET',
      body: {
        data: [
          {
            'transaction.id': '7663aab8a',
            'span.id': '3aab8a77fe231',
          },
        ],
      },
    });

    const {result} = renderHook(
      ({filters, fields, referrer}) =>
        useSpanSamples({
          search: MutableSearch.fromQueryObject(filters),
          fields,
          referrer,
          min: 100,
          max: 900,
        }),
      {
        wrapper: Wrapper,
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
            release: '0.0.1',
          },
          fields: [
            SpanIndexedField.TRANSACTION_ID,
            SpanIndexedField.SPAN_ID,
          ] as SpanIndexedProperty[],
          referrer: 'api-spec',
        },
      }
    );

    expect(result.current.isPending).toBe(true);

    expect(request).toHaveBeenCalledWith(
      '/api/0/organizations/org-slug/spans-samples/',
      expect.objectContaining({
        method: 'GET',
        query: {
          additionalFields: ['transaction.id', 'span_id'],
          project: [],
          query: `span.group:221aa7ebd216 release:0.0.1`,
          referrer: 'api-spec',
          statsPeriod: '10d',
          environment: ['prod'],
          lowerBound: 100,
          firstBound: 300,
          secondBound: 600,
          upperBound: 900,
          utc: false,
        },
      })
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual([
      {
        'transaction.id': '7663aab8a',
        'span.id': '3aab8a77fe231',
      },
    ]);
  });
});
