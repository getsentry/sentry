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
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  };
}

describe('useTraceItemAttributeKeys', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const mockAttributeKeys = [
    {
      key: 'test.attribute1',
      name: 'Test Attribute 1',
      kind: FieldKind.TAG,
    },
    {
      key: 'test.attribute2',
      name: 'Test Attribute 2',
      kind: FieldKind.TAG,
    },
    {
      key: 'test.attribute3',
      name: 'Test Attribute 3',
      kind: FieldKind.TAG,
    },
    {
      key: 'sentry.attribute',
      name: 'Sentry Attribute',
      kind: FieldKind.TAG,
    },
  ];

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    mockedUsedLocation.mockReturnValue(LocationFixture());

    // Setup the PageFilters store with default values
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

  it('fetches attribute keys correctly for string type', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: mockAttributeKeys,
      match: [
        (_url: string, options: {query?: Record<string, any>}) => {
          const query = options?.query || {};
          return (
            query.itemType === TraceItemDataset.LOGS && query.attributeType === 'string'
          );
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeKeys({
          traceItemType: TraceItemDataset.LOGS,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockResponse).toHaveBeenCalled();

    // Verify expected attributes (excluding sentry. prefixed ones)
    const expectedAttributes = {
      'test.attribute1': {
        key: 'test.attribute1',
        name: 'Test Attribute 1',
        kind: FieldKind.TAG,
      },
      'test.attribute2': {
        key: 'test.attribute2',
        name: 'Test Attribute 2',
        kind: FieldKind.TAG,
      },
      'test.attribute3': {
        key: 'test.attribute3',
        name: 'Test Attribute 3',
        kind: FieldKind.TAG,
      },
    };

    expect(result.current.attributes).toEqual(expectedAttributes);
  });

  it('fetches attribute keys correctly for number type', async () => {
    const numberAttributeKeys = [
      {
        key: 'measurement.duration',
        name: 'Duration',
        kind: FieldKind.MEASUREMENT,
      },
      {
        key: 'measurement.size',
        name: 'Size',
        kind: FieldKind.MEASUREMENT,
      },
    ];

    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: numberAttributeKeys,
      match: [
        (_url: string, options: {query?: Record<string, any>}) => {
          const query = options?.query || {};
          return (
            query.itemType === TraceItemDataset.LOGS && query.attributeType === 'number'
          );
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeKeys({
          traceItemType: TraceItemDataset.LOGS,
          type: 'number',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockResponse).toHaveBeenCalled();

    const expectedAttributes = {
      'measurement.duration': {
        key: 'measurement.duration',
        name: 'Duration',
        kind: FieldKind.MEASUREMENT,
      },
      'measurement.size': {
        key: 'measurement.size',
        name: 'Size',
        kind: FieldKind.MEASUREMENT,
      },
    };

    expect(result.current.attributes).toEqual(expectedAttributes);
  });
  it('test escape characters on the query', async () => {
    const attributesWithInvalidChars = [
      {
        key: 'valid.attribute',
        name: 'Valid Attribute',
        kind: FieldKind.TAG,
      },
      {
        key: 'valid-attribute-with-dash',
        name: 'Valid Attribute With Dash',
        kind: FieldKind.TAG,
      },
      {
        key: 'another_valid.attribute',
        name: 'Another Valid Attribute',
        kind: FieldKind.TAG,
      },
      {
        key: 'invalid attribute',
        name: 'Invalid Attribute',
        kind: FieldKind.TAG,
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: attributesWithInvalidChars,
    });

    const {result} = renderHook(
      () =>
        useTraceItemAttributeKeys({
          traceItemType: TraceItemDataset.LOGS,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should only contain valid attributes
    const expectedAttributes = {
      'valid.attribute': {
        key: 'valid.attribute',
        name: 'Valid Attribute',
        kind: FieldKind.TAG,
      },
      'valid-attribute-with-dash': {
        key: 'valid-attribute-with-dash',
        name: 'Valid Attribute With Dash',
        kind: FieldKind.TAG,
      },
      'another_valid.attribute': {
        key: 'another_valid.attribute',
        name: 'Another Valid Attribute',
        kind: FieldKind.TAG,
      },
    };

    expect(result.current.attributes).toEqual(expectedAttributes);
  });
});
