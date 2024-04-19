import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanSamples} from 'sentry/views/performance/http/data/useSpanSamples';
import type {IndexedProperty} from 'sentry/views/starfish/types';
import {SpanIndexedField} from 'sentry/views/starfish/types';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useSpanSamples', () => {
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

  jest.mocked(useOrganization).mockReturnValue(organization);

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
            SpanIndexedField.ID,
          ] as IndexedProperty[],
          enabled: false,
        },
      }
    );

    expect(result.current.isFetching).toEqual(false);
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
            environment: undefined,
          },
          fields: [
            SpanIndexedField.TRANSACTION_ID,
            SpanIndexedField.ID,
          ] as IndexedProperty[],
          referrer: 'api-spec',
        },
      }
    );

    expect(result.current.isLoading).toEqual(true);

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
          lowerBound: 100,
          firstBound: 300,
          secondBound: 600,
          upperBound: 900,
          utc: false,
        },
      })
    );

    await waitFor(() => expect(result.current.isLoading).toEqual(false));
    expect(result.current.data).toEqual([
      {
        'transaction.id': '7663aab8a',
        'span.id': '3aab8a77fe231',
      },
    ]);
  });
});
