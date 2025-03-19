import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraceItemAttributeValues} from 'sentry/views/explore/hooks/useTraceItemAttributeValues';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext.Provider value={organization}>
          {children}
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('useTraceItemAttributeValues', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const attributeKey = 'test.attribute';
  const mockAttributeValues = [
    {
      key: attributeKey,
      value: 'value1',
      first_seen: null,
      last_seen: null,
      times_seen: null,
    },
    {
      key: attributeKey,
      value: 'value2',
      first_seen: null,
      last_seen: null,
      times_seen: null,
    },
    {
      key: attributeKey,
      value: 'value3',
      first_seen: null,
      last_seen: null,
      times_seen: null,
    },
  ];

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    mockedUsedLocation.mockReturnValue(LocationFixture());

    const {organization: _initOrg} = initializeOrg();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [1],
        environments: [],
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: false,
        },
      },
      new Set()
    );
  });

  it('fetches attribute values correctly', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockAttributeValues,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return (
            query.item_type === TraceItemDataset.LOGS &&
            query.attribute_type === 'string' &&
            !query.query
          );
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          attributeKey,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockResponse).toHaveBeenCalled();
    expect(result.current.data).toEqual(['value1', 'value2', 'value3']);
  });

  it('applies search filters', async () => {
    const searchTerm = 'value';
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockAttributeValues,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return (
            query.item_type === TraceItemDataset.LOGS &&
            query.attribute_type === 'string' &&
            query.query === searchTerm
          );
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          attributeKey,
          search: searchTerm,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockResponse).toHaveBeenCalled();
  });

  it('applies project filters', async () => {
    const projectIds = [1, 2, 3];
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockAttributeValues,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return (
            query.item_type === TraceItemDataset.LOGS &&
            query.attribute_type === 'string' &&
            JSON.stringify(query.project) === JSON.stringify(projectIds.map(String))
          );
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          attributeKey,
          projectIds,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockResponse).toHaveBeenCalled();
  });

  it('getTraceItemAttributeValues works correctly for string type', async () => {
    const mockSearchResponse = [
      {
        key: attributeKey,
        value: 'search-result',
        first_seen: null,
        last_seen: null,
        times_seen: null,
      },
    ];

    // Initial fetch
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockAttributeValues,
    });

    // Mock getTraceItemAttributeValues call
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockSearchResponse,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.query === 'search-query';
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          attributeKey,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current.getTraceItemAttributeValues(
      tag,
      'search-query'
    );

    expect(searchQueryMock).toHaveBeenCalled();
    expect(searchResults).toEqual(['search-result']);
  });

  it('getTraceItemAttributeValues returns empty array for number type', async () => {
    const mockSearchResponse = [
      {
        key: attributeKey,
        value: 'search-result',
        first_seen: null,
        last_seen: null,
        times_seen: null,
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockAttributeValues,
    });

    // Mock for the getTraceItemAttributeValues call
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockSearchResponse,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.query === 'search-query';
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          attributeKey,
          type: 'number',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current.getTraceItemAttributeValues(
      tag,
      'search-query'
    );

    expect(searchQueryMock).not.toHaveBeenCalled();
    expect(searchResults).toEqual([]); // This will always return an empty array because we don't suggest values for numbers
  });
});
