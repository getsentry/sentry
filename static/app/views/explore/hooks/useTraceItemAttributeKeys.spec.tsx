import {LocationFixture} from 'sentry-fixture/locationFixture';
import {mockTraceItemAttributeKeysApi} from 'sentry-fixture/traceItemAttributeKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {Tag} from 'sentry/types/group';
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
  const {organization} = initializeOrg();
  const mockAttributeKeys: Tag[] = [
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

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    mockedUsedLocation.mockReturnValue(LocationFixture());

    // Setup the PageFilters store with default values
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
    const mockResponse = mockTraceItemAttributeKeysApi(
      organization.slug,
      mockAttributeKeys
    );

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

    const expectedAttributes = {
      'test.attribute1': {
        key: 'test.attribute1',
        name: 'Test Attribute 1',
        kind: FieldKind.TAG,
        secondaryAliases: [],
      },
      'test.attribute2': {
        key: 'test.attribute2',
        name: 'Test Attribute 2',
        kind: FieldKind.TAG,
        secondaryAliases: [],
      },
      'test.attribute3': {
        key: 'test.attribute3',
        name: 'Test Attribute 3',
        kind: FieldKind.TAG,
        secondaryAliases: [],
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

    const mockResponse = mockTraceItemAttributeKeysApi(
      organization.slug,
      numberAttributeKeys,
      TraceItemDataset.LOGS,
      'number'
    );

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
        secondaryAliases: [],
      },
      'measurement.size': {
        key: 'measurement.size',
        name: 'Size',
        kind: FieldKind.MEASUREMENT,
        secondaryAliases: [],
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

    mockTraceItemAttributeKeysApi(organization.slug, attributesWithInvalidChars);

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

    const expectedAttributes = {
      'valid.attribute': {
        key: 'valid.attribute',
        name: 'Valid Attribute',
        kind: FieldKind.TAG,
        secondaryAliases: [],
      },
      'valid-attribute-with-dash': {
        key: 'valid-attribute-with-dash',
        name: 'Valid Attribute With Dash',
        kind: FieldKind.TAG,
        secondaryAliases: [],
      },
      'another_valid.attribute': {
        key: 'another_valid.attribute',
        name: 'Another Valid Attribute',
        kind: FieldKind.TAG,
        secondaryAliases: [],
      },
    };

    expect(result.current.attributes).toEqual(expectedAttributes);
  });

  it('should return secondary aliases for attributes', async () => {
    const testAttributeKeys = [
      {
        key: 'test.attribute1',
        name: 'Test Attribute 1',
        kind: FieldKind.TAG,
        secondaryAliases: ['test.attribute1.alias'],
      },
      {
        key: 'test.attribute2',
        name: 'Test Attribute 2',
        kind: FieldKind.TAG,
        secondaryAliases: ['test.attribute2.alias'],
      },
    ];

    const mockResponse = mockTraceItemAttributeKeysApi(
      organization.slug,
      testAttributeKeys
    );

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
        secondaryAliases: ['test.attribute1.alias'],
      },
      'test.attribute2': {
        key: 'test.attribute2',
        name: 'Test Attribute 2',
        kind: FieldKind.TAG,
        secondaryAliases: ['test.attribute2.alias'],
      },
    };

    expect(result.current.attributes).toEqual(expectedAttributes);
  });
});
