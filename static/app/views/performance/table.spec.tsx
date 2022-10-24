import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';

import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {OrganizationContext} from 'sentry/views/organizationContext';
import Table from 'sentry/views/performance/table';

const FEATURES = ['performance-view'];

const initializeData = (settings = {}, features: string[] = []) => {
  const projects = [
    TestStubs.Project({id: '1', slug: '1'}),
    TestStubs.Project({id: '2', slug: '2'}),
  ];
  return _initializeData({
    features: [...FEATURES, ...features],
    projects,
    selectedProject: projects[0],
    ...settings,
  });
};

const WrappedComponent = ({data, ...rest}) => {
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
};

function openContextMenu(wrapper, cellIndex) {
  const menu = wrapper.find('CellAction').at(cellIndex);
  // Hover over the menu
  menu.find('Container > div').at(0).simulate('mouseEnter');
  wrapper.update();

  // Open the menu
  wrapper.find('MenuButton').simulate('click');

  // Return the menu wrapper so we can interact with it.
  return wrapper.find('CellAction').at(cellIndex).find('Menu');
}

function mockEventView(data) {
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
    project: [data.projects[0].id, data.projects[1].id],
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
  let eventsV2Mock, eventsMock;
  beforeEach(function () {
    browserHistory.push = jest.fn();
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
    ];
    eventsV2Mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: eventsMetaFieldsMock,
        data: eventsBodyMock,
      },
    });
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

  describe('with eventsv2', function () {
    it('renders correct cell actions without feature', async function () {
      const data = initializeData({
        query: 'event.type:transaction transaction:/api*',
      });

      const wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
        />
      );

      await tick();
      wrapper.update();
      const firstRow = wrapper.find('GridBody').find('GridRow').at(0);
      const transactionCell = firstRow.find('GridBodyCell').at(1);
      expect(transactionCell.find('Link').prop('to')).toEqual({
        pathname: '/organizations/org-slug/performance/summary/',
        query: {
          transaction: '/apple/cart',
          project: '2',
          environment: [],
          statsPeriod: '14d',
          start: '2019-10-01T00:00:00',
          end: '2019-10-02T00:00:00',
          query: '', // drops 'transaction:/api*' and 'event.type:transaction' from the query
          referrer: 'performance-transaction-summary',
          unselectedSeries: 'p100()',
          showTransactions: undefined,
          display: undefined,
          trendFunction: undefined,
          trendColumn: undefined,
        },
      });
      const userMiseryCell = firstRow.find('GridBodyCell').at(9);
      const cellAction = userMiseryCell.find('CellAction');

      expect(cellAction.prop('allowActions')).toEqual([
        'add',
        'exclude',
        'show_greater_than',
        'show_less_than',
        'edit_threshold',
      ]);

      const menu = openContextMenu(wrapper, 8); // User Misery Cell Action
      expect(menu.find('MenuButtons').find('ActionItem')).toHaveLength(3);
      expect(menu.find('MenuButtons').find('ActionItem').at(2).text()).toEqual(
        'Edit threshold (300ms)'
      );
    });

    it('hides cell actions when withStaticFilters is true', async function () {
      const data = initializeData(
        {
          query: 'event.type:transaction transaction:/api*',
        },
        ['performance-frontend-use-events-endpoint']
      );

      const wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
          withStaticFilters
        />
      );

      await tick();
      wrapper.update();
      const firstRow = wrapper.find('GridBody').find('GridRow').at(0);
      const userMiseryCell = firstRow.find('GridBodyCell').at(9);
      const cellAction = userMiseryCell.find('CellAction');

      expect(cellAction.prop('allowActions')).toEqual([]);
    });

    it('sends MEP param when setting enabled', async function () {
      const data = initializeData(
        {
          query: 'event.type:transaction transaction:/api*',
        },
        ['performance-use-metrics']
      );

      const wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
          isMEPEnabled
        />
      );

      await tick();
      wrapper.update();

      expect(eventsV2Mock).toHaveBeenCalledTimes(1);
      expect(eventsV2Mock).toHaveBeenNthCalledWith(
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

  describe('with events', function () {
    it('renders correct cell actions without feature', async function () {
      const data = initializeData(
        {
          query: 'event.type:transaction transaction:/api*',
        },
        ['performance-frontend-use-events-endpoint']
      );

      const wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
        />
      );

      await tick();
      wrapper.update();
      const firstRow = wrapper.find('GridBody').find('GridRow').at(0);
      const transactionCell = firstRow.find('GridBodyCell').at(1);
      expect(transactionCell.find('Link').prop('to')).toEqual({
        pathname: '/organizations/org-slug/performance/summary/',
        query: {
          transaction: '/apple/cart',
          project: '2',
          environment: [],
          statsPeriod: '14d',
          start: '2019-10-01T00:00:00',
          end: '2019-10-02T00:00:00',
          query: '', // drops 'transaction:/api*' and 'event.type:transaction' from the query
          referrer: 'performance-transaction-summary',
          unselectedSeries: 'p100()',
          showTransactions: undefined,
          display: undefined,
          trendFunction: undefined,
          trendColumn: undefined,
        },
      });
      const userMiseryCell = firstRow.find('GridBodyCell').at(9);
      const cellAction = userMiseryCell.find('CellAction');

      expect(cellAction.prop('allowActions')).toEqual([
        'add',
        'exclude',
        'show_greater_than',
        'show_less_than',
        'edit_threshold',
      ]);

      const menu = openContextMenu(wrapper, 8); // User Misery Cell Action
      expect(menu.find('MenuButtons').find('ActionItem')).toHaveLength(3);
      expect(menu.find('MenuButtons').find('ActionItem').at(2).text()).toEqual(
        'Edit threshold (300ms)'
      );
    });

    it('hides cell actions when withStaticFilters is true', async function () {
      const data = initializeData(
        {
          query: 'event.type:transaction transaction:/api*',
        },
        ['performance-frontend-use-events-endpoint']
      );

      const wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
          withStaticFilters
        />
      );

      await tick();
      wrapper.update();
      const firstRow = wrapper.find('GridBody').find('GridRow').at(0);
      const userMiseryCell = firstRow.find('GridBodyCell').at(9);
      const cellAction = userMiseryCell.find('CellAction');

      expect(cellAction.prop('allowActions')).toEqual([]);
    });

    it('sends MEP param when setting enabled', async function () {
      const data = initializeData(
        {
          query: 'event.type:transaction transaction:/api*',
        },
        ['performance-use-metrics', 'performance-frontend-use-events-endpoint']
      );

      const wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          eventView={mockEventView(data)}
          setError={jest.fn()}
          summaryConditions=""
          projects={data.projects}
          isMEPEnabled
        />
      );

      await tick();
      wrapper.update();

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
