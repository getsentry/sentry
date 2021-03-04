import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import * as globalSelection from 'app/actionCreators/globalSelection';
import ProjectsStore from 'app/stores/projectsStore';
import PerformanceLanding, {FilterViews} from 'app/views/performance/landing';
import {DEFAULT_MAX_DURATION} from 'app/views/performance/trends/utils';
import {vitalAbbreviations} from 'app/views/performance/vitalDetail/utils';

const FEATURES = ['transaction-event', 'performance-view'];

function initializeData(projects, query, features = FEATURES) {
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: query || {},
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

function initializeTrendsData(query, addDefaultQuery = true) {
  const projects = [
    TestStubs.Project({id: '1', firstTransactionEvent: false}),
    TestStubs.Project({id: '2', firstTransactionEvent: true}),
  ];
  const organization = TestStubs.Organization({
    FEATURES,
    projects,
  });

  const otherTrendsQuery = addDefaultQuery
    ? {
        query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
      }
    : {};

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          ...otherTrendsQuery,
          ...query,
        },
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance > Landing', function () {
  beforeEach(function () {
    browserHistory.push = jest.fn();
    jest.spyOn(globalSelection, 'updateDateTime');

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
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {
            user: 'string',
            transaction: 'string',
            'project.id': 'integer',
            tpm: 'number',
            p50: 'number',
            p95: 'number',
            failure_rate: 'number',
            apdex_300: 'number',
            count_unique_user: 'number',
            user_misery_300: 'number',
          },
          data: [
            {
              transaction: '/apple/cart',
              'project.id': 1,
              user: 'uhoh@example.com',
              tpm: 30,
              p50: 100,
              p95: 500,
              failure_rate: 0.1,
              apdex_300: 0.6,
              count_unique_user: 1000,
              user_misery_300: 122,
            },
          ],
        },
      },
      {
        predicate: (_, options) => {
          if (!options.hasOwnProperty('query')) {
            return false;
          } else if (!options.query.hasOwnProperty('field')) {
            return false;
          }
          return !options.query.field.includes('key_transaction');
        },
      }
    );
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {
            user: 'string',
            transaction: 'string',
            'project.id': 'integer',
            tpm: 'number',
            p50: 'number',
            p95: 'number',
            failure_rate: 'number',
            apdex_300: 'number',
            count_unique_user: 'number',
            user_misery_300: 'number',
          },
          data: [
            {
              key_transaction: 1,
              transaction: '/apple/cart',
              'project.id': 1,
              user: 'uhoh@example.com',
              tpm: 30,
              p50: 100,
              p95: 500,
              failure_rate: 0.1,
              apdex_300: 0.6,
              count_unique_user: 1000,
              user_misery_300: 122,
            },
            {
              key_transaction: 0,
              transaction: '/apple/checkout',
              'project.id': 1,
              user: 'uhoh@example.com',
              tpm: 30,
              p50: 100,
              p95: 500,
              failure_rate: 0.1,
              apdex_300: 0.6,
              count_unique_user: 1000,
              user_misery_300: 122,
            },
          ],
        },
      },
      {
        predicate: (_, options) => {
          if (!options.hasOwnProperty('query')) {
            return false;
          } else if (!options.query.hasOwnProperty('field')) {
            return false;
          }
          return options.query.field.includes('key_transaction');
        },
      }
    );
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends/',
      body: {
        stats: {},
        events: {meta: {}, data: []},
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends-stats/',
      body: {
        stats: {},
        events: {meta: {}, data: []},
      },
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    globalSelection.updateDateTime.mockRestore();
  });

  it('renders basic UI elements', async function () {
    const projects = [TestStubs.Project({firstTransactionEvent: true})];
    const data = initializeData(projects, {});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    // Check number of rendered tab buttons
    expect(wrapper.find('PageHeader ButtonBar Button')).toHaveLength(2);

    // No onboarding should show.
    expect(wrapper.find('Onboarding')).toHaveLength(0);

    // Chart and Table should render.
    expect(wrapper.find('ChartFooter')).toHaveLength(1);
    expect(wrapper.find('Table')).toHaveLength(1);
  });

  it('renders onboarding state when the selected project has no events', async function () {
    const projects = [
      TestStubs.Project({id: 1, firstTransactionEvent: false}),
      TestStubs.Project({id: 2, firstTransactionEvent: true}),
    ];
    const data = initializeData(projects, {project: [1]});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    // onboarding should show.
    expect(wrapper.find('Onboarding')).toHaveLength(1);

    // Chart and table should not show.
    expect(wrapper.find('ChartFooter')).toHaveLength(0);
    expect(wrapper.find('Table')).toHaveLength(0);
  });

  it('does not render onboarding for "my projects"', async function () {
    const projects = [
      TestStubs.Project({id: '1', firstTransactionEvent: false}),
      TestStubs.Project({id: '2', firstTransactionEvent: true}),
    ];
    const data = initializeData(projects, {project: ['-1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('Onboarding')).toHaveLength(0);
  });

  it('forwards conditions to transaction summary', async function () {
    const projects = [TestStubs.Project({id: '1', firstTransactionEvent: true})];
    const data = initializeData(projects, {project: ['1'], query: 'sentry:yes'});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    const link = wrapper.find('[data-test-id="grid-editable"] GridBody Link').at(0);
    link.simulate('click', {button: 0});

    expect(data.router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          transaction: '/apple/cart',
          query: 'sentry:yes',
        }),
      })
    );
  });

  it('Default period for trends does not call updateDateTime', async function () {
    const data = initializeTrendsData({query: 'tag:value'}, false);
    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();
    expect(globalSelection.updateDateTime).toHaveBeenCalledTimes(0);
  });

  it('Navigating to trends does not modify statsPeriod when already set', async function () {
    const data = initializeTrendsData({
      query: `tpm():>0.005 transaction.duration:>10 transaction.duration:<${DEFAULT_MAX_DURATION}`,
      statsPeriod: '24h',
    });

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    const trendsLink = wrapper.find('[data-test-id="landing-header-trends"]').at(0);
    trendsLink.simulate('click');

    expect(globalSelection.updateDateTime).toHaveBeenCalledTimes(0);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          query: `tpm():>0.005 transaction.duration:>10 transaction.duration:<${DEFAULT_MAX_DURATION}`,
          statsPeriod: '24h',
          view: 'TRENDS',
        },
      })
    );
  });

  it('Default page (transactions) without trends feature will not update filters if none are set', async function () {
    const projects = [
      TestStubs.Project({id: 1, firstTransactionEvent: false}),
      TestStubs.Project({id: 2, firstTransactionEvent: true}),
    ];
    const data = initializeData(projects, {view: undefined});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(browserHistory.push).toHaveBeenCalledTimes(0);
  });

  it('Default page (transactions) with trends feature will not update filters if none are set', async function () {
    const data = initializeTrendsData({view: undefined}, false);

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(browserHistory.push).toHaveBeenCalledTimes(0);
  });

  it('Visiting trends with trends feature will update filters if none are set', async function () {
    const data = initializeTrendsData({view: FilterViews.TRENDS}, false);

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(browserHistory.push).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: {
          query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
          view: 'TRENDS',
        },
      })
    );
  });

  it('Tags are replaced with trends default query if navigating to trends', async function () {
    const data = initializeTrendsData(
      {view: FilterViews.ALL_TRANSACTIONS, query: 'device.family:Mac'},
      false
    );

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    const trendsLink = wrapper.find('[data-test-id="landing-header-trends"]').at(0);
    trendsLink.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
          view: 'TRENDS',
        },
      })
    );
  });

  it('Vitals cards are not shown with overview feature without frontend platform', async function () {
    const projects = [TestStubs.Project({id: '1', firstTransactionEvent: true})];
    const data = initializeData(
      projects,
      {project: ['1'], query: 'sentry:yes', view: FilterViews.ALL_TRANSACTIONS},
      [...FEATURES, 'performance-vitals-overview']
    );

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    const vitalsContainer = wrapper.find('VitalsContainer');
    expect(vitalsContainer).toHaveLength(0);
  });

  it('Vitals cards are shown with overview feature with frontend platform project', async function () {
    const projects = [
      TestStubs.Project({
        id: '1',
        firstTransactionEvent: true,
        platform: 'javascript-react',
      }),
    ];
    const data = initializeData(
      projects,
      {project: ['1'], query: 'sentry:yes', view: FilterViews.ALL_TRANSACTIONS},
      [...FEATURES, 'performance-vitals-overview']
    );

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    const vitalsContainer = wrapper.find('VitalsContainer');
    expect(vitalsContainer).toHaveLength(1);

    const vitalTestIds = Object.values(vitalAbbreviations).map(
      abbr => `vitals-linked-card-${abbr}`
    );

    for (const testId of vitalTestIds) {
      const selector = `a[data-test-id="${testId}"]`;
      const link = wrapper.find(selector);
      expect(link).toHaveLength(1);
    }
  });

  it('Navigating away from trends will remove extra tags from query', async function () {
    const data = initializeTrendsData(
      {
        view: FilterViews.TRENDS,
        query: `device.family:Mac tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
      },
      false
    );

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    browserHistory.push.mockReset();

    const byTransactionLink = wrapper
      .find('[data-test-id="landing-header-all_transactions"]')
      .at(0);
    byTransactionLink.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          query: 'device.family:Mac',
          view: 'ALL_TRANSACTIONS',
        },
      })
    );
  });
});
