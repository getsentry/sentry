import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
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

describe('useGetTraceItemAttributeValues', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const attributeKey = 'test.attribute';

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
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockSearchResponse,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.substringMatch === 'search-query';
        },
      ],
    });

    const {result} = renderHook(
      () =>
        useGetTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          type: 'string',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current(tag, 'search-query');

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
        useGetTraceItemAttributeValues({
          traceItemType: TraceItemDataset.LOGS,
          type: 'number',
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current(tag, 'search-query');

    expect(searchQueryMock).not.toHaveBeenCalled();
    expect(searchResults).toEqual([]); // This will always return an empty array because we don't suggest values for numbers
  });
});
