import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import TransactionSummary from 'app/views/performance/transactionSummary';

function initializeData({features: additionalFeatures = []} = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  // if (hasTrendsFeature) {
  //   features.push('trends');
  // }
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
          transactionCursor: '1:0:0',
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
      url: '/organizations/org-slug/releases/stats/',
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

    // Mock totals for the sidebar and other summary data
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {
            count: 'number',
            apdex_300: 'number',
            user_misery_300: 'number',
            count_unique_user: 'number',
            p95: 'number',
          },
          data: [
            {
              count: 2,
              apdex_300: 0.6,
              user_misery_300: 122,
              count_unique_user: 1,
              p95: 750.123,
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
              'project.id': 1,
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
        project: 1,
        transactionCursor: '2:0:0',
      },
    });
  });

  it('Show trend display with beta feature', async function () {
    const initialData = initializeData({features: ['trends']});
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const displayDropdown = wrapper.find('ChartControls OptionSelector');
    expect(displayDropdown).toHaveLength(1);

    const displayItems = displayDropdown.find('DropdownItem');
    expect(displayItems).toHaveLength(4);

    expect(displayItems.at(3).text()).toEqual('Trends');
  });

  it('Do not show trend display without beta feature', async function () {
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

    const displayDropdown = wrapper.find('ChartControls OptionSelector');
    expect(displayDropdown).toHaveLength(1);

    const displayItems = displayDropdown.find('DropdownItem');
    expect(displayItems).toHaveLength(3);
  });

  it('shows web vital display with feature', async function () {
    const initialData = initializeData({features: ['measurements']});
    const wrapper = mountWithTheme(
      <TransactionSummary
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const displayDropdown = wrapper.find('ChartControls OptionSelector');
    expect(displayDropdown).toHaveLength(1);

    const displayItems = displayDropdown.find('DropdownItem');
    expect(displayItems).toHaveLength(4);

    expect(displayItems.at(3).text()).toEqual('Web Vitals');
  });

  it('shows not web vital display without feature', async function () {
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

    const displayDropdown = wrapper.find('ChartControls OptionSelector');
    expect(displayDropdown).toHaveLength(1);

    const displayItems = displayDropdown.find('DropdownItem');
    expect(displayItems).toHaveLength(3);
  });
});
