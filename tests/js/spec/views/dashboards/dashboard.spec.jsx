import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {mountWithTheme} from 'sentry-test/enzyme';

import Dashboard from 'app/views/dashboards/dashboard';
import OrganizationDashboardContainer from 'app/views/dashboards';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('app/utils/withLatestContext');

describe('OrganizationDashboard', function () {
  let wrapper;
  let discoverMock;

  const {organization, projects, router, routerContext} = initializeOrg({
    projects: [{isMember: true}, {isMember: true, slug: 'new-project', id: 3}],
    organization: {
      features: ['discover', 'global-views'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/dashboard/?statsPeriod=14d&utc=true',
        query: {},
      },
    },
  });

  const org = organization;

  const createWrapper = props => {
    wrapper = mountWithTheme(
      <OrganizationDashboardContainer>
        <Dashboard {...props} />
      </OrganizationDashboardContainer>,
      routerContext
    );
    mockRouterPush(wrapper, router);
  };

  beforeEach(async function () {
    ProjectsStore.loadInitialData(projects);
    await tick();

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    discoverMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/',
      method: 'POST',
      body: {
        data: [],
        meta: [],
        timing: {},
      },
    });
  });

  afterEach(function () {
    router.push.mockRestore();
    MockApiClient.clearMockResponses();
    if (wrapper) {
      wrapper.unmount();
    }
    discoverMock.mockRestore();
  });

  it('queries and renders discover-based widgets grouped by time', async function () {
    createWrapper(TestStubs.Dashboard());
    await tick();
    wrapper.update();

    expect(discoverMock).toHaveBeenCalledTimes(2);
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: expect.arrayContaining([2, 3]),
          range: '14d',

          fields: [],
          conditions: [['user.email', 'IS NOT NULL', null]],
          aggregations: [['uniq', 'user.email', 'Known Users']],
          limit: 1000,
          orderby: '-time',
          groupby: ['time'],
          rollup: 86400,
        }),
      })
    );
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: expect.arrayContaining([2, 3]),
          range: '14d',

          fields: [],
          conditions: [['user.email', 'IS NULL', null]],
          aggregations: [['count()', null, 'Anonymous Users']],
          limit: 1000,
          orderby: '-time',
          groupby: ['time'],
          rollup: 86400,
        }),
      })
    );

    await tick();
    wrapper.update();

    // Should have one LineChart
    expect(wrapper.find('LineChart')).toHaveLength(1);
  });

  it('queries and renders discover-based widgets not grouped by time', async function () {
    createWrapper(
      TestStubs.Dashboard([
        TestStubs.Widget(
          {
            discover: [
              {
                name: 'Browsers',
                fields: ['browser.name'],
                conditions: [],
                aggregations: [['count()', null, 'count']],
                limit: 1000,

                orderby: '-count',
                groupby: ['browser.name'],
              },
            ],
          },
          {
            type: 'table',
            title: 'Table',
          }
        ),
      ])
    );

    expect(discoverMock).toHaveBeenCalledTimes(1);
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: expect.arrayContaining([2, 3]),
          range: '14d',

          fields: ['browser.name'],
          conditions: [],
          aggregations: [['count()', null, 'count']],
          limit: 1000,
          orderby: '-count',
          groupby: ['browser.name'],
        }),
      })
    );

    await tick();
    wrapper.update();

    // Should have one LineChart
    expect(wrapper.find('PercentageTableChart')).toHaveLength(1);
  });
});
