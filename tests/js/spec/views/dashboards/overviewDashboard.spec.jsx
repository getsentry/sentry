import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {mountWithTheme} from 'sentry-test/enzyme';
import DashboardsContainer from 'app/views/dashboards';
import OverviewDashboard from 'app/views/dashboards/overviewDashboard';

jest.mock('app/utils/withLatestContext');

describe('OverviewDashboard', function() {
  let wrapper;
  let discoverMock;
  let releasesMock;

  const {organization, router, routerContext} = initializeOrg({
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
      <DashboardsContainer>
        <OverviewDashboard params={{orgId: organization.slug}} {...props} />
      </DashboardsContainer>,
      routerContext
    );
    mockRouterPush(wrapper, router);
  };

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    releasesMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/releases/`,
      body: [TestStubs.Release()],
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

  afterEach(function() {
    router.push.mockRestore();
    MockApiClient.clearMockResponses();
    if (wrapper) {
      wrapper.unmount();
    }
    discoverMock.mockRestore();
    releasesMock.mockRestore();
  });

  it('renders and updates "recentReleases" constraint ', async function() {
    const eventsByReleaseWidget = TestStubs.Widget({
      discover: [
        {
          name: 'Events by Release',
          fields: ['release'],
          constraints: ['recentReleases'],
          conditions: [],
          aggregations: [['count()', null, 'Events']],
          limit: 5000,

          orderby: '-time',
          groupby: ['time', 'release'],
          rollup: 86400,
        },
      ],
    });
    const dashboardData = TestStubs.Dashboard([
      TestStubs.Widget(),
      eventsByReleaseWidget,
    ]);

    createWrapper(dashboardData);

    // TODO(billy): Figure out why releases gets called twice
    expect(discoverMock).toHaveBeenCalledTimes(4);

    expect(releasesMock).toHaveBeenCalledTimes(1);

    // Known users
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: [2, 3],
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

    // Anonymous users
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: [2, 3],
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

    // Events by Release
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: [2, 3],
          range: '14d',

          fields: [],
          conditions: [],
          aggregations: [['count()', null, 'Events']],
          conditionFields: [
            [
              'if',
              [
                [
                  'in',
                  ['release', 'tuple', ["'92eccef279d966b2319f0802fa4b22b430a5f72b'"]],
                ],
                'release',
                "'other'",
              ],
              'release',
            ],
          ],
          limit: 5000,
          orderby: '-time',
          groupby: ['time', 'release'],
          name: 'Events by Release',
          rollup: 86400,
        }),
      })
    );

    await tick();
    wrapper.update();

    // Should have two LineCharts
    expect(wrapper.find('LineChart')).toHaveLength(2);

    discoverMock.mockRestore();
    releasesMock.mockRestore();

    // Change date time
    wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
    wrapper.find('SelectorItem[value="7d"]').simulate('click');
    wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();

    expect(discoverMock).toHaveBeenCalledTimes(4);

    // Doesn't get called again because it doesn't use global selection header
    // This request just fetches last 100 (paginated) releases
    expect(releasesMock).toHaveBeenCalledTimes(0);

    // requested with update date
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: [2, 3],
          range: '14d',

          fields: [],
          conditions: [],
          aggregations: [['count()', null, 'Events']],
          conditionFields: [
            [
              'if',
              [
                [
                  'in',
                  ['release', 'tuple', ["'92eccef279d966b2319f0802fa4b22b430a5f72b'"]],
                ],
                'release',
                "'other'",
              ],
              'release',
            ],
          ],
          limit: 5000,
          orderby: '-time',
          groupby: ['time', 'release'],
          name: 'Events by Release',
          rollup: 86400,
        }),
      })
    );
  });
});
