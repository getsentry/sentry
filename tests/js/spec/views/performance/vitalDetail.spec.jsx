import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import VitalDetail from 'app/views/performance/vitalDetail/';

function initializeData({features: additionalFeatures = []} = {}) {
  const features = [
    'discover-basic',
    'performance-view',
    'performance-vitals-overview',
    ...additionalFeatures,
  ];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          project: 1,
        },
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance > VitalDetail', function () {
  beforeEach(function () {
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
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
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.lcp': {
          poor: 1,
          meh: 2,
          good: 3,
          total: 6,
          p75: 4500,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          count: 'integer',
          p95_measurements_lcp: 'duration',
          transaction: 'string',
          p50_measurements_lcp: 'duration',
          project: 'string',
          compare_numeric_aggregate_p75_measurements_lcp_greater_4000: 'number',
          'project.id': 'integer',
          count_unique_user: 'integer',
          p75_measurements_lcp: 'duration',
        },
        data: [
          {
            count: 100000,
            p95_measurements_lcp: 5000,
            transaction: 'something',
            p50_measurements_lcp: 3500,
            project: 'javascript',
            compare_numeric_aggregate_p75_measurements_lcp_greater_4000: 1,
            count_unique_user: 10000,
            p75_measurements_lcp: 4500,
          },
        ],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <VitalDetail
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // It shows a search bar
    expect(wrapper.find('StyledSearchBar')).toHaveLength(1);

    // It shows the vital card
    expect(wrapper.find('vitalInfo')).toHaveLength(1);

    // It shows a chart
    expect(wrapper.find('VitalChart')).toHaveLength(1);

    // It shows a table
    expect(wrapper.find('Table')).toHaveLength(1);
  });

  it('triggers a navigation on search', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <VitalDetail
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
        project: 1,
        statsPeriod: '14d',
        query: 'user.email:uhoh*',
      },
    });
  });

  it('Applies conditions when linking to transaction summary', async function () {
    const initialData = initializeData({query: {query: 'tag:value'}});
    const wrapper = mountWithTheme(
      <VitalDetail
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const firstTransactionFromList = wrapper.find('Table GridBody GridRow Link').at(1);

    expect(firstTransactionFromList.prop('to')).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/summary/',
        query: expect.objectContaining({
          display: 'vitals',
          query: 'has:measurements.lcp',
          showTransactions: 'recent',
          statsPeriod: '24h',
          transaction: 'something',
        }),
      })
    );
  });
});
