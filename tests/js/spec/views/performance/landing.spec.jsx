import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import PerformanceLanding from 'app/views/performance/landing';

function initializeData(projects, query) {
  const features = ['transaction-event', 'performance-view'];
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

describe('Performance > Landing', function () {
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

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
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
});
