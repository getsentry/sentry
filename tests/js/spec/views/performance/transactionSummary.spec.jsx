import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import TransactionSummary from 'app/views/performance/transactionSummary';

function initializeData() {
  const features = ['discover-basic', 'performance-view'];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
    apdexThreshold: 400,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: 1,
        },
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance > TransactionSummary', function () {
  beforeEach(function () {
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
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url:
        '/organizations/org-slug/issues/?limit=5&project=1&query=is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
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
      url: '/organizations/org-slug/is-key-transactions/',
      body: [],
    });

    // This mock is used for both the sidebar and table.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          id: 'string',
          user: 'string',
          'transaction.duration': 'duration',
          'project.id': 'integer',
          timestamp: 'date',
          apdex: 'number',
          user_misery_300: 'number',
        },
        data: [
          {
            id: 'deadbeef',
            user: 'uhoh@example.com',
            'transaction.duration': 400,
            'project.id': 1,
            timestamp: '2020-05-21T15:31:18+00:00',
            apdex: 0.6,
            user_misery_300: 122,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
      },
    });
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
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
    expect(wrapper.find('CreateAlertButton')).toHaveLength(0);
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
    expect(wrapper.find('CreateAlertButton')).toHaveLength(1);
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
    const searchBar = wrapper.find('SearchBar input');
    searchBar
      .simulate('change', {target: {value: 'user.email:uhoh*'}})
      .simulate('submit', {preventDefault() {}});
    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: 1,
        statsPeriod: '14d',
        query: 'user.email:uhoh*',
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
    wrapper.find('KeyTransactionButton').simulate('click');

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
        project: 1,
        showTransactions: 'fastest',
      },
    });
  });
});
