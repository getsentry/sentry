import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {NonDefaultSpanSampleFields} from 'sentry/views/insights/common/queries/useSpanSamples';
import {useSpanSamples} from 'sentry/views/insights/http/queries/useSpanSamples';

describe('useSpanSamples', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    jest.clearAllMocks();
    PageFiltersStore.onInitializeUrlState({
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: ['prod'],
      projects: [],
    });
  });

  it('respects the `enabled` prop', () => {
    const request = MockApiClient.addMockResponse({
      url: `/api/0/organizations/${organization.slug}/spans-samples/`,
      method: 'GET',
      body: {data: []},
    });

    const {result} = renderHookWithProviders(
      ({fields, enabled}) => useSpanSamples({fields, enabled}),
      {
        initialProps: {
          fields: [] satisfies NonDefaultSpanSampleFields[],
          enabled: false,
        },
        organization,
      }
    );

    expect(result.current.isFetching).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('queries for current selection', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans-samples/`,
      method: 'GET',
      body: {
        data: [
          {
            'transaction.span_id': '7663aab8a',
            'span.id': '3aab8a77fe231',
          },
        ],
        meta: {
          fields: {
            'transaction.span_id': 'string',
            'span.id': 'string',
          },
          units: {
            'transaction.span_id': null,
            'span.id': null,
          },
        },
      },
    });

    const {result} = renderHookWithProviders(
      ({filters, fields, referrer}) =>
        useSpanSamples({
          search: MutableSearch.fromQueryObject(filters),
          fields,
          referrer,
          min: 100,
          max: 900,
        }),
      {
        initialProps: {
          filters: {
            'span.group': '221aa7ebd216',
            release: '0.0.1',
          },
          fields: [] satisfies NonDefaultSpanSampleFields[],
          referrer: 'api-spec',
        },
        organization,
      }
    );

    expect(result.current.isPending).toBe(true);

    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/spans-samples/',
      expect.objectContaining({
        method: 'GET',
        query: {
          additionalFields: ['transaction.span_id'],
          project: [],
          dataset: 'spans',
          sampling: 'NORMAL',
          query: `span.group:221aa7ebd216 release:0.0.1`,
          referrer: 'api-spec',
          statsPeriod: '10d',
          environment: ['prod'],
          lowerBound: 100,
          firstBound: 300,
          secondBound: 600,
          upperBound: 900,
          sort: '-timestamp',
          utc: false,
        },
      })
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual({
      data: [
        {
          'transaction.span_id': '7663aab8a',
          'span.id': '3aab8a77fe231',
        },
      ],
      meta: {
        fields: {
          'transaction.span_id': 'string',
          'span.id': 'string',
        },
        units: {
          'transaction.span_id': null,
          'span.id': null,
        },
      },
    });
  });
});
