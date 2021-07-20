import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import TransactionSummary from 'app/views/performance/transactionSummary';

const teams = [
  TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
  TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
];

function initializeData({features: additionalFeatures = [], query = {}} = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const project = TestStubs.Project({teams});
  const organization = TestStubs.Organization({
    features,
    projects: [project],
    apdexThreshold: 400,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: 2,
          transactionCursor: '1:0:0',
          ...query,
        },
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  TeamStore.loadInitialData(teams);
  return initialData;
}

describe('Performance > TransactionSummary', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=2&query=is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/is-key-transactions/',
      body: [],
    });

    // Mock totals for the sidebar and other summary data
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {
            count: 'number',
            apdex_400: 'number',
            count_miserable_user_400: 'number',
            user_misery_400: 'number',
            count_unique_user: 'number',
            p95: 'number',
            failure_rate: 'number',
            tpm: 'number',
          },
          data: [
            {
              count: 2,
              apdex_400: 0.6,
              count_miserable_user_400: 122,
              user_misery_400: 0.114,
              count_unique_user: 1,
              p95: 750.123,
              failure_rate: 1,
              tpm: 1,
            },
          ],
        },
      },
      {
        predicate: (url, options) => {
          return url.includes('eventsv2') && options.query?.field.includes('p95()');
        },
      }
    );
    // Transaction list response
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        headers: {
          Link:
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
        },
        body: {
          meta: {
            id: 'string',
            'user.display': 'string',
            'transaction.duration': 'duration',
            'project.id': 'integer',
            timestamp: 'date',
          },
          data: [
            {
              id: 'deadbeef',
              'user.display': 'uhoh@example.com',
              'transaction.duration': 400,
              'project.id': 2,
              timestamp: '2020-05-21T15:31:18+00:00',
            },
          ],
        },
      },
      {
        predicate: (url, options) => {
          return (
            url.includes('eventsv2') && options.query?.field.includes('user.display')
          );
        },
      }
    );
    // Mock totals for status breakdown
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {
            'transaction.status': 'string',
            count: 'number',
          },
          data: [
            {
              count: 2,
              'transaction.status': 'ok',
            },
          ],
        },
      },
      {
        predicate: (url, options) => {
          return (
            url.includes('eventsv2') &&
            options.query?.field.includes('transaction.status')
          );
        },
      }
    );
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets/',
      body: [
        {
          key: 'release',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'environment',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.fcp': {
          poor: 3,
          meh: 100,
          good: 47,
          total: 150,
          p75: 1500,
        },
        'measurements.lcp': {
          poor: 2,
          meh: 38,
          good: 40,
          total: 80,
          p75: 2750,
        },
        'measurements.fid': {
          poor: 2,
          meh: 53,
          good: 5,
          total: 60,
          p75: 1000,
        },
        'measurements.cls': {
          poor: 3,
          meh: 10,
          good: 4,
          total: 17,
          p75: 0.2,
        },
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();
  });

  it('renders basic UI elements', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // It shows a chart
    expect(wrapper.find('TransactionSummaryCharts')).toHaveLength(1);

    // It shows a searchbar
    expect(wrapper.find('SearchBar')).toHaveLength(1);

    // It shows a table
    expect(wrapper.find('PanelTable')).toHaveLength(1);

    // Ensure open in discover button exists.
    expect(wrapper.find('a[data-test-id="discover-open"]')).toHaveLength(1);
    // Ensure navigation is correct.

    // Ensure open issues button exists.
    expect(wrapper.find('a[data-test-id="issues-open"]')).toHaveLength(1);

    // Ensure transaction filter button exists
    expect(wrapper.find('[data-test-id="filter-transactions"]')).toHaveLength(1);

    // Ensure create alert from discover is hidden without metric alert
    expect(wrapper.find('CreateAlertFromViewButton')).toHaveLength(0);

    // Ensure status breakdown exists
    expect(wrapper.find('StatusBreakdown')).toHaveLength(1);
  });

  it('renders feature flagged UI elements', async function () {
    const initialData = initializeData();
    initialData.organization.features.push('incidents');
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // Ensure create alert from discover is shown with metric alerts
    expect(wrapper.find('CreateAlertFromViewButton')).toHaveLength(1);
  });

  it('fetches transaction threshdold', async function () {
    const initialData = initializeData({
      features: ['project-transaction-threshold-override'],
    });
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });

    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('fetches project transaction threshdold', async function () {
    const initialData = initializeData({
      features: ['project-transaction-threshold-override'],
    });
    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      statusCode: 404,
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });

    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('triggers a navigation on search', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // Fill out the search box, and submit it.
    const searchBar = wrapper.find('SearchBar textarea');
    searchBar
      .simulate('change', {target: {value: 'user.email:uhoh*'}})
      .simulate('submit', {preventDefault() {}});
    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: 2,
        statsPeriod: '14d',
        query: 'user.email:uhoh*',
        transactionCursor: '1:0:0',
      },
    });
  });

  it('can mark a transaction as key', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/key-transactions/`,
      method: 'POST',
      body: {},
    });

    // Click the key transaction button
    wrapper.find('TitleButton').simulate('click');

    await tick();
    wrapper.update();

    wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');

    // Ensure request was made.
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('triggers a navigation on transaction filter', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // Open the transaction filter dropdown
    wrapper.find('[data-test-id="filter-transactions"] button').simulate('click');

    // Click the second item (fastest transactions)
    wrapper
      .find('[data-test-id="filter-transactions"] DropdownItem span')
      .at(1)
      .simulate('click');

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: 2,
        showTransactions: 'slow',
        transactionCursor: undefined,
      },
    });
  });

  it('renders pagination buttons', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const pagination = wrapper.find('Pagination');
    expect(pagination).toHaveLength(1);

    // Click the 'next' button'
    pagination.find('button[aria-label="Next"]').simulate('click');

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: 2,
        transactionCursor: '2:0:0',
      },
    });
  });

  it('forwards conditions to related issues', async function () {
    const issueGet = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=2&query=tag%3Avalue%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
      body: [],
    });

    const initialData = initializeData({query: {query: 'tag:value'}});
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(issueGet).toHaveBeenCalled();
  });

  it('does not forward event type to related issues', async function () {
    const issueGet = MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/issues/?limit=5&project=2&query=tag%3Avalue%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
        body: [],
      },
      {
        predicate: (url, options) =>
          url.startsWith(`/organizations/org-slug/issues/`) &&
          // event.type must NOT be in the query params
          !options.query?.query?.includes('event.type'),
      }
    );

    const initialData = initializeData({
      query: {query: 'tag:value event.type:transaction'},
    });
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(issueGet).toHaveBeenCalled();
  });

  it('adds search condition on transaction status when clicking on status breakdown', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    wrapper.find('BarContainer[data-test-id="status-ok"]').at(0).simulate('click');
    await tick();
    wrapper.update();

    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          query: expect.stringContaining('transaction.status:ok'),
        }),
      })
    );
  });
});
