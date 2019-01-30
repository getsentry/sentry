import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mockRouterPush} from 'app-test/helpers/mockRouterPush';

import Dashboard from 'app/views/organizationDashboard/dashboard';
import OrganizationDashboardContainer from 'app/views/organizationDashboard';

jest.mock('app/utils/withLatestContext');

describe('OrganizationDashboard', function() {
  const {organization, router, routerContext} = initializeOrg({
    projects: [{isMember: true}, {isMember: true, slug: 'new-project', id: 3}],
    organization: {
      features: ['sentry10', 'global-views'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/dashboard/?statsPeriod=14d&utc=true',
        query: {},
      },
    },
  });
  const org = organization;

  let discoverMock;

  beforeEach(function() {
    router.push.mockRestore();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: TestStubs.Environments(),
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

  it('queries and renders discover-based widgets grouped by time', async function() {
    let wrapper = mount(
      <OrganizationDashboardContainer>
        <Dashboard {...TestStubs.Dashboard()} />
      </OrganizationDashboardContainer>,
      routerContext
    );
    mockRouterPush(wrapper, router);

    expect(discoverMock).toHaveBeenCalledTimes(2);
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

    await tick();
    wrapper.update();

    // Should have one LineChart
    expect(wrapper.find('LineChart')).toHaveLength(1);
  });

  it('queries and renders discover-based widgets not grouped by time', async function() {
    let wrapper = mount(
      <OrganizationDashboardContainer>
        <Dashboard
          {...TestStubs.Dashboard([
            TestStubs.Widget(
              {
                discover: [
                  {
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
          ])}
        />
      </OrganizationDashboardContainer>,
      routerContext
    );
    mockRouterPush(wrapper, router);

    expect(discoverMock).toHaveBeenCalledTimes(1);
    expect(discoverMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: [],
          projects: [2, 3],
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
