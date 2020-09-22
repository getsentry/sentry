import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import PerformanceLanding from 'app/views/performance/landing';

const FEATURES = ['transaction-event', 'performance-view'];

function initializeData(projects, query) {
  const organization = TestStubs.Organization({
    features: FEATURES,
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

describe('Performance > Landing', function() {
  beforeEach(function() {
    browserHistory.push.mockReset();
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
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          user: 'string',
          transaction: 'string',
          'project.id': 'integer',
          epm: 'number',
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
            epm: 30,
            p50: 100,
            p95: 500,
            failure_rate: 0.1,
            apdex_300: 0.6,
            count_unique_user: 1000,
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
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function() {
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
    expect(wrapper.find('ButtonBar Button')).toHaveLength(2);

    // No onboarding should show.
    expect(wrapper.find('Onboarding')).toHaveLength(0);

    // Chart and Table should render.
    expect(wrapper.find('ChartFooter')).toHaveLength(1);
    expect(wrapper.find('Table')).toHaveLength(1);
  });

  it('renders onboarding state when the selected project has no events', async function() {
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

  it('does not render onboarding for "my projects"', async function() {
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

  it('forwards conditions to transaction summary', async function() {
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

  it('Sets default period when navigating to trends when stats period is not set', async function() {
    const features = [...FEATURES, 'trends'];
    const projects = [
      TestStubs.Project({id: '1', firstTransactionEvent: false}),
      TestStubs.Project({id: '2', firstTransactionEvent: true}),
    ];
    const organization = TestStubs.Organization({
      features,
      projects,
    });

    const data = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          query: 'tag:value count():>1000 transaction.duration:>0',
          statsPeriod: '14d',
          view: 'TRENDS',
        },
      })
    );
  });

  it('Navigating to trends does not modify statsPeriod when already set', async function() {
    const features = [...FEATURES, 'trends'];
    const projects = [
      TestStubs.Project({id: '1', firstTransactionEvent: false}),
      TestStubs.Project({id: '2', firstTransactionEvent: true}),
    ];
    const organization = TestStubs.Organization({
      features,
      projects,
    });

    const data = initializeOrg({
      organization,
      router: {
        location: {
          query: {query: 'count():>500 transaction.duration:>10', statsPeriod: '24h'},
        },
      },
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          query: 'count():>500 transaction.duration:>10',
          statsPeriod: '24h',
          view: 'TRENDS',
        },
      })
    );
  });
});
