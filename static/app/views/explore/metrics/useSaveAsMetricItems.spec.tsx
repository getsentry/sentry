import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock('sentry/actionCreators/modal');

const mockedUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);
const mockOpenSaveQueryModal = jest.mocked(modal.openSaveQueryModal);

describe('useSaveAsMetricItems', () => {
  const organization = OrganizationFixture({
    features: ['tracemetrics-enabled', 'tracemetrics-saved-queries'],
  });
  const project = ProjectFixture({id: '1'});
  const queryClient = makeTestQueryClient();
  ProjectsStore.loadInitialData([project]);

  function createWrapper() {
    return function ({children}: {children?: React.ReactNode}) {
      return (
        <OrganizationContext.Provider value={organization}>
          <QueryClientProvider client={queryClient}>
            <MockMetricQueryParamsContext>{children}</MockMetricQueryParamsContext>
          </QueryClientProvider>
        </OrganizationContext.Provider>
      );
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    queryClient.clear();

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          interval: '5m',
        },
      })
    );
    mockUseNavigate.mockReturnValue(jest.fn());

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'Test Query'},
    });
  });

  it('should open save query modal when save as new query is clicked', () => {
    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {wrapper: createWrapper()}
    );

    const saveAsItems = result.current;
    const saveAsQuery = saveAsItems.find(item => item.key === 'save-query') as {
      onAction: () => void;
    };

    saveAsQuery?.onAction?.();

    expect(mockOpenSaveQueryModal).toHaveBeenCalledWith({
      organization,
      saveQuery: expect.any(Function),
      source: 'table',
      traceItemDataset: 'tracemetrics',
    });
  });

  it('should show both existing and new query options when saved query exists', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/test-query-id/`,
      body: {
        id: 'test-query-id',
        name: 'Test Metrics Query',
        isPrebuilt: false,
        query: [{}],
        dateAdded: '2024-01-01T00:00:00.000Z',
        dateUpdated: '2024-01-01T00:00:00.000Z',
        interval: '5m',
        lastVisited: '2024-01-01T00:00:00.000Z',
        position: null,
        projects: [1],
        dataset: 'tracemetrics',
        starred: false,
      },
    });

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          id: 'test-query-id',
          interval: '5m',
        },
      })
    );

    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(result.current.some(item => item.key === 'update-query')).toBe(true);
    });

    const saveAsItems = result.current;
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('should show only new query option when no saved query exists', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          interval: '5m',
        },
      })
    );

    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {wrapper: createWrapper()}
    );

    const saveAsItems = result.current;

    expect(saveAsItems.some(item => item.key === 'update-query')).toBe(false);
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('should return empty array when metrics saved queries UI is not enabled', () => {
    const orgWithoutFeature = OrganizationFixture({
      features: [],
    });

    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {
        wrapper: function ({children}: {children?: React.ReactNode}) {
          return (
            <OrganizationContext.Provider value={orgWithoutFeature}>
              <QueryClientProvider client={queryClient}>
                <MockMetricQueryParamsContext>{children}</MockMetricQueryParamsContext>
              </QueryClientProvider>
            </OrganizationContext.Provider>
          );
        },
      }
    );

    const saveAsItems = result.current;
    expect(saveAsItems).toEqual([]);
  });
});
