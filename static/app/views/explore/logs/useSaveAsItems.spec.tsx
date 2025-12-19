import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useSaveAsItems} from 'sentry/views/explore/logs/useSaveAsItems';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useRouter');
jest.mock('sentry/actionCreators/modal');

const mockedUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);
const mockUsePageFilters = jest.mocked(usePageFilters);
const mockOpenSaveQueryModal = jest.mocked(modal.openSaveQueryModal);

describe('useSaveAsItems', () => {
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled'],
  });
  const project = ProjectFixture({id: '1'});
  const queryClient = makeTestQueryClient();
  let saveQueryMock: jest.Mock;
  ProjectsStore.loadInitialData([project]);

  function createWrapper() {
    return function ({children}: {children?: React.ReactNode}) {
      return (
        <OrganizationContext.Provider value={organization}>
          <QueryClientProvider client={queryClient}>
            <LogsQueryParamsProvider
              analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
              source="location"
            >
              {children}
            </LogsQueryParamsProvider>
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
          logsFields: ['timestamp', 'message', 'user.email'],
          logsQuery: 'message:"test error"',
          logsSortBys: ['-timestamp'],
          aggregateField: [
            {groupBy: 'message.template'},
            {
              yAxes: ['count(message)'],
            },
          ].map(aggregateField => JSON.stringify(aggregateField)),
          mode: 'aggregate',
        },
      })
    );
    mockUseNavigate.mockReturnValue(jest.fn());
    mockUsePageFilters.mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: PageFiltersFixture({
        projects: [1],
        environments: ['production'],
        datetime: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-01T01:00:00.000Z',
          period: '1h',
          utc: false,
        },
      }),
    });

    saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'Test Query'},
    });
  });

  it('should open save query modal when save as new query is clicked', () => {
    const {result} = renderHookWithProviders(
      () =>
        useSaveAsItems({
          visualizes: [new VisualizeFunction('count()')],
          groupBys: ['message.template'],
          interval: '5m',
          mode: Mode.AGGREGATE,
          search: new MutableSearch('message:"test error"'),
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        }),
      {additionalWrapper: createWrapper()}
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
      traceItemDataset: 'logs',
    });
  });

  it('should show both existing and new query options when saved query exists', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/test-query-id/`,
      body: {
        id: 'test-query-id',
        name: 'Test Query',
        isPrebuilt: false,
        query: [{}],
        dateAdded: '2024-01-01T00:00:00.000Z',
        dateUpdated: '2024-01-01T00:00:00.000Z',
        interval: '5m',
        lastVisited: '2024-01-01T00:00:00.000Z',
        position: null,
        projects: [1],
        dataset: 'logs',
        starred: false,
      },
    });

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          id: 'test-query-id',
          logsFields: ['timestamp', 'message'],
          logsQuery: 'message:"test"',
          mode: 'aggregate',
        },
      })
    );

    const {result} = renderHookWithProviders(
      () =>
        useSaveAsItems({
          visualizes: [new VisualizeFunction('count()')],
          groupBys: ['message.template'],
          interval: '5m',
          mode: Mode.AGGREGATE,
          search: new MutableSearch('message:"test"'),
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        }),
      {additionalWrapper: createWrapper()}
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
          logsFields: ['timestamp', 'message'],
          logsQuery: 'message:"test"',
          mode: 'aggregate',
        },
      })
    );

    const {result} = renderHookWithProviders(
      () =>
        useSaveAsItems({
          visualizes: [new VisualizeFunction('count()')],
          groupBys: ['message.template'],
          interval: '5m',
          mode: Mode.AGGREGATE,
          search: new MutableSearch('message:"test"'),
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        }),
      {additionalWrapper: createWrapper()}
    );

    const saveAsItems = result.current;

    expect(saveAsItems.some(item => item.key === 'update-query')).toBe(false);
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('should call saveQuery with correct parameters when modal saves', async () => {
    const {result} = renderHookWithProviders(
      () =>
        useSaveAsItems({
          visualizes: [new VisualizeFunction('count()')],
          groupBys: ['message.template'],
          // Note: useSaveQuery uses the value returned by useChartInterval()
          // not the interval passed in as options.
          interval: '5m',
          mode: Mode.AGGREGATE,
          search: new MutableSearch('message:"test error"'),
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        }),
      {additionalWrapper: createWrapper()}
    );

    const saveAsItems = result.current;
    const saveAsQuery = saveAsItems.find(item => item.key === 'save-query') as {
      onAction: () => void;
    };

    saveAsQuery?.onAction?.();

    expect(mockOpenSaveQueryModal).toHaveBeenCalled();

    const modalCall = mockOpenSaveQueryModal.mock.calls[0];
    if (!modalCall) {
      throw new Error('No modal call found');
    }
    const saveQueryFn = modalCall[0].saveQuery;

    await saveQueryFn('Test Query Title', true);

    await waitFor(() => {
      expect(saveQueryMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/explore/saved/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            name: 'Test Query Title',
            projects: [1],
            dataset: 'logs',
            start: '2024-01-01T00:00:00.000Z',
            end: '2024-01-01T01:00:00.000Z',
            range: '1h',
            environment: ['production'],
            interval: '1m',
            query: [
              {
                fields: ['timestamp', 'message', 'user.email'],
                orderby: '-timestamp',
                query: 'message:"test error"',
                aggregateField: [
                  {groupBy: 'message.template'},
                  {yAxes: ['count(message)']},
                ],
                mode: Mode.AGGREGATE,
              },
            ],
            starred: true,
          }),
        })
      );
    });
  });
});
