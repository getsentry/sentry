import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {OrganizationContext} from 'sentry/views/organizationContext';
import Table from 'sentry/views/performance/table';

const FEATURES = ['performance-view'];

jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const initializeData = (settings = {}, features: string[] = []) => {
  const projects = [
    ProjectFixture({id: '1', slug: '1'}),
    ProjectFixture({id: '2', slug: '2'}),
  ];
  return _initializeData({
    features: [...FEATURES, ...features],
    projects,
    selectedProject: projects[0],
    ...settings,
  });
};

function WrappedComponent({data, ...rest}: any) {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <MEPSettingProvider>
        <Table
          organization={data.organization}
          location={data.router.location}
          setError={jest.fn()}
          summaryConditions=""
          {...data}
          {...rest}
        />
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
}

function mockEventView(data: ReturnType<typeof initializeData>) {
  const eventView = new EventView({
    id: '1',
    name: 'my query',
    fields: [
      {
        field: 'team_key_transaction',
      },
      {
        field: 'transaction',
      },
      {
        field: 'project',
      },
      {
        field: 'tpm()',
      },
      {
        field: 'p50()',
      },
      {
        field: 'p95()',
      },
      {
        field: 'failure_rate()',
      },
      {
        field: 'apdex()',
      },
      {
        field: 'count_unique(user)',
      },
      {
        field: 'count_miserable(user)',
      },
      {
        field: 'user_misery()',
      },
    ],
    sorts: [{field: 'tpm  ', kind: 'desc'}],
    query: 'event.type:transaction transaction:/api*',
    project: [Number(data.projects[0]!.id), Number(data.projects[1]!.id)],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
    additionalConditions: new MutableSearch(''),
    createdBy: undefined,
    interval: undefined,
    display: '',
    team: [],
    topEvents: undefined,
    yAxis: undefined,
  });
  return eventView;
}

describe('Performance > Table', function () {
  let eventsMock: jest.Mock;
  beforeEach(function () {
    mockUseLocation.mockReturnValue(
      LocationFixture({pathname: '/organizations/org-slug/performance/summary'})
    );
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    const eventsMetaFieldsMock = {
      user: 'string',
      transaction: 'string',
      project: 'string',
      tpm: 'number',
      p50: 'number',
      p95: 'number',
      failure_rate: 'number',
      apdex: 'number',
      count_unique_user: 'number',
      count_miserable_user: 'number',
      user_misery: 'number',
    };
    const eventsBodyMock = [
      {
        team_key_transaction: 1,
        transaction: '/apple/cart',
        project: '2',
        user: 'uhoh@example.com',
        tpm: 30,
        p50: 100,
        p95: 500,
        failure_rate: 0.1,
        apdex: 0.6,
        count_unique_user: 1000,
        count_miserable_user: 122,
        user_misery: 0.114,
        project_threshold_config: ['duration', 300],
      },
      {
        team_key_transaction: 0,
        transaction: '/apple/checkout',
        project: '1',
        user: 'uhoh@example.com',
        tpm: 30,
        p50: 100,
        p95: 500,
        failure_rate: 0.1,
        apdex: 0.6,
        count_unique_user: 1000,
        count_miserable_user: 122,
        user_misery: 0.114,
        project_threshold_config: ['duration', 300],
      },
      {
        team_key_transaction: 0,
        transaction: '<< unparameterized >>',
        project: '3',
        user: 'uhoh@example.com',
        tpm: 1,
        p50: 100,
        p95: 500,
        failure_rate: 0.1,
        apdex: 0.6,
        count_unique_user: 500,
        count_miserable_user: 31,
        user_misery: 0.514,
        project_threshold_config: ['duration', 300],
      },
    ];
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {fields: eventsMetaFieldsMock},
        data: eventsBodyMock,
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('with events', function () {
    it('renders correct cell actions without feature', async function () {
      const data = initializeData({
        query: 'event.type:transaction transaction:/api*',
      });

      ProjectsStore.loadInitialData(data.projects);

      render(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
        />,
        {router: data.router}
      );

      const rows = await screen.findAllByTestId('grid-body-row');
      const transactionCells = within(rows[0]!).getAllByTestId('grid-body-cell');
      const transactionCell = transactionCells[1]!;
      const link = within(transactionCell).getByRole('link', {name: '/apple/cart'});
      expect(link).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/summary/?end=2019-10-02T00%3A00%3A00&project=2&query=&referrer=performance-transaction-summary&start=2019-10-01T00%3A00%3A00&statsPeriod=14d&transaction=%2Fapple%2Fcart&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );

      const cellActionContainers = screen.getAllByTestId('cell-action-container');
      expect(cellActionContainers).toHaveLength(27); // 9 cols x 3 rows
      const cellActionTriggers = screen.getAllByRole('button', {name: 'Actions'});
      expect(cellActionTriggers[8]).toBeInTheDocument();
      await userEvent.click(cellActionTriggers[8]!);

      expect(
        screen.getByRole('menuitemradio', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values less than'})
      ).toBeInTheDocument();

      await userEvent.keyboard('{Escape}'); // Close actions menu

      const transactionCellTrigger = cellActionTriggers[0]!; // Transaction name
      expect(transactionCellTrigger).toBeInTheDocument();
      await userEvent.click(transactionCellTrigger);

      expect(data.router.push).toHaveBeenCalledTimes(0);
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

      expect(data.router.push).toHaveBeenCalledTimes(1);
      expect(data.router.push).toHaveBeenNthCalledWith(1, {
        pathname: undefined,
        query: expect.objectContaining({
          query: 'transaction:/apple/cart',
        }),
      });
    });

    it('hides cell actions when withStaticFilters is true', async function () {
      const data = initializeData({
        query: 'event.type:transaction transaction:/api*',
      });

      render(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
          withStaticFilters
        />
      );

      expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();
      const cellActionContainers = screen.queryByTestId('cell-action-container');
      expect(cellActionContainers).not.toBeInTheDocument();
    });

    it('shows unparameterized tooltip when project only recently sent events', async function () {
      const projects = [
        ProjectFixture({id: '1', slug: '1'}),
        ProjectFixture({id: '2', slug: '2'}),
        ProjectFixture({id: '3', slug: '3', firstEvent: new Date().toISOString()}),
      ];
      const data = initializeData({
        query: 'event.type:transaction transaction:/api*',
        projects,
      });

      ProjectsStore.loadInitialData(data.projects);

      render(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
        />
      );

      const indicatorContainer = await screen.findByTestId('unparameterized-indicator');
      expect(indicatorContainer).toBeInTheDocument();
    });

    it('does not show unparameterized tooltip when project only recently sent events', async function () {
      const projects = [
        ProjectFixture({id: '1', slug: '1'}),
        ProjectFixture({id: '2', slug: '2'}),
        ProjectFixture({
          id: '3',
          slug: '3',
          firstEvent: new Date(+new Date() - 25920e5).toISOString(),
        }),
      ];
      const data = initializeData({
        query: 'event.type:transaction transaction:/api*',
        projects,
      });

      ProjectsStore.loadInitialData(data.projects);

      render(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
        />
      );

      expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();
      const indicatorContainer = screen.queryByTestId('unparameterized-indicator');
      expect(indicatorContainer).not.toBeInTheDocument();
    });

    it('sends MEP param when setting enabled', async function () {
      const data = initializeData(
        {
          query: 'event.type:transaction transaction:/api*',
        },
        ['performance-use-metrics']
      );

      render(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
          isMEPEnabled
        />
      );

      expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();
      expect(eventsMock).toHaveBeenCalledTimes(1);
      expect(eventsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            environment: [],
            field: [
              'team_key_transaction',
              'transaction',
              'project',
              'tpm()',
              'p50()',
              'p95()',
              'failure_rate()',
              'apdex()',
              'count_unique(user)',
              'count_miserable(user)',
              'user_misery()',
            ],
            dataset: 'metrics',
            per_page: 50,
            project: ['1', '2'],
            query: 'event.type:transaction transaction:/api*',
            referrer: 'api.performance.landing-table',
            sort: '-team_key_transaction',
            statsPeriod: '14d',
          }),
        })
      );
    });
  });
});
