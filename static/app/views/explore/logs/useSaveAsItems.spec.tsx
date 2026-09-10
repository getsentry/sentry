import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType} from 'sentry/views/dashboards/types';
import * as discoverUtils from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useSaveAsItems} from 'sentry/views/explore/logs/useSaveAsItems';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

jest.mock('sentry/actionCreators/modal');

const mockOpenSaveQueryModal = jest.mocked(modal.openSaveQueryModal);

describe('useSaveAsItems', () => {
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled'],
  });
  const project = ProjectFixture({id: '1'});
  const queryClient = makeTestQueryClient();
  const initialLocation = {
    pathname: '/mock-pathname/',
    query: {
      logsFields: ['timestamp', 'message', 'user.email'],
      logsQuery: 'message:"test error"',
      logsSortBys: ['-timestamp'],
      aggregateField: [{groupBy: 'message.template'}, {yAxes: ['count(message)']}].map(
        aggregateField => JSON.stringify(aggregateField)
      ),
      mode: 'aggregate',
    },
  };
  let saveQueryMock: jest.Mock;

  function createWrapper() {
    return function ({children}: {children?: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <LogsQueryParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            source="location"
          >
            {children}
          </LogsQueryParamsProvider>
        </QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    queryClient.clear();
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: ['production'],
        datetime: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-01T01:00:00.000Z',
          period: '1h',
          utc: false,
        },
      })
    );

    saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'Test Query'},
    });
  });

  afterEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();
  });

  it('should open save query modal when save as new query is clicked', () => {
    const {result} = renderHookWithProviders(useSaveAsItems, {
      additionalWrapper: createWrapper(),
      organization,
      initialRouterConfig: {location: initialLocation},
      initialProps: {
        visualizes: [new VisualizeFunction('count()')],
        groupBys: ['message.template'],
        interval: '5m',
        mode: Mode.AGGREGATE,
        search: new MutableSearch('message:"test error"'),
        sortBys: [{field: 'timestamp', kind: 'desc'}],
      },
    });

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

    const {result} = renderHookWithProviders(useSaveAsItems, {
      additionalWrapper: createWrapper(),
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/mock-pathname/',
          query: {
            id: 'test-query-id',
            logsFields: ['timestamp', 'message'],
            logsQuery: 'message:"test"',
            mode: 'aggregate',
          },
        },
      },
      initialProps: {
        visualizes: [new VisualizeFunction('count()')],
        groupBys: ['message.template'],
        interval: '5m',
        mode: Mode.AGGREGATE,
        search: new MutableSearch('message:"test"'),
        sortBys: [{field: 'timestamp', kind: 'desc'}],
      },
    });

    await waitFor(() => {
      expect(result.current.some(item => item.key === 'update-query')).toBe(true);
    });

    const saveAsItems = result.current;
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('should show only new query option when no saved query exists', () => {
    const {result} = renderHookWithProviders(useSaveAsItems, {
      additionalWrapper: createWrapper(),
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/mock-pathname/',
          query: {
            logsFields: ['timestamp', 'message'],
            logsQuery: 'message:"test"',
            mode: 'aggregate',
          },
        },
      },
      initialProps: {
        visualizes: [new VisualizeFunction('count()')],
        groupBys: ['message.template'],
        interval: '5m',
        mode: Mode.AGGREGATE,
        search: new MutableSearch('message:"test"'),
        sortBys: [{field: 'timestamp', kind: 'desc'}],
      },
    });

    const saveAsItems = result.current;

    expect(saveAsItems.some(item => item.key === 'update-query')).toBe(false);
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('enables the alert option when there are aggregates', () => {
    const {result} = renderHookWithProviders(useSaveAsItems, {
      additionalWrapper: createWrapper(),
      organization,
      initialRouterConfig: {location: initialLocation},
      initialProps: {
        visualizes: [new VisualizeFunction('count()')],
        groupBys: ['message.template'],
        interval: '5m',
        mode: Mode.AGGREGATE,
        search: new MutableSearch('message:"test error"'),
        sortBys: [{field: 'timestamp', kind: 'desc'}],
      },
    });

    const alertItem = result.current.find(item => item.key === 'create-alert') as
      | {children: unknown[]; disabled: boolean}
      | undefined;

    expect(alertItem?.disabled).toBe(false);
    expect(alertItem?.children).toHaveLength(1);
  });

  it('preserves the chart type when adding a dashboard widget', () => {
    const handleAddQueryToDashboard = jest
      .spyOn(discoverUtils, 'handleAddQueryToDashboard')
      .mockImplementation(() => {});

    const {result, router} = renderHookWithProviders(useSaveAsItems, {
      additionalWrapper: createWrapper(),
      organization,
      initialRouterConfig: {location: initialLocation},
      initialProps: {
        visualizes: [
          new VisualizeFunction('count(message)', {chartType: ChartType.LINE}),
        ],
        groupBys: ['message.template'],
        interval: '5m',
        mode: Mode.AGGREGATE,
        search: new MutableSearch('message:"test error"'),
        sortBys: [{field: 'timestamp', kind: 'desc'}],
      },
    });

    const saveAsDashboard = result.current.find(
      item => item.key === 'add-to-dashboard'
    ) as {children: Array<{onAction: () => void}>};

    saveAsDashboard.children[0]!.onAction();

    expect(router.location.pathname).toBe(initialLocation.pathname);
    expect(router.location.query).toEqual(
      expect.objectContaining({
        logsFields: initialLocation.query.logsFields,
        logsQuery: initialLocation.query.logsQuery,
        logsSortBys: '-timestamp',
      })
    );
    expect(handleAddQueryToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        eventView: expect.objectContaining({display: DisplayType.LINE}),
      })
    );
  });

  it('should call saveQuery with correct parameters when modal saves', async () => {
    const {result} = renderHookWithProviders(useSaveAsItems, {
      additionalWrapper: createWrapper(),
      organization,
      initialRouterConfig: {location: initialLocation},
      initialProps: {
        visualizes: [new VisualizeFunction('count()')],
        groupBys: ['message.template'],
        // Note: useSaveQuery uses the value returned by useChartInterval()
        // not the interval passed in as options.
        interval: '5m',
        mode: Mode.AGGREGATE,
        search: new MutableSearch('message:"test error"'),
        sortBys: [{field: 'timestamp', kind: 'desc'}],
      },
    });

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

    await saveQueryFn({name: 'Test Query Title', starred: true});

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
