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
      features: ['sentry10'],
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
      url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
      method: 'POST',
      body: {
        data: [],
        meta: [],
        timing: [],
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

  // This tests the component's `shouldComponentUpdate`
  // Use `search` to compare instead of `query` because that's what we check in `AsyncComponent`
  // it('location.query changes updates events table', async function() {
  // let wrapper = mount(
  // <OrganizationDashboard
  // organization={org}
  // location={{
  // search: '?statsPeriod=14d',
  // query: {
  // statsPeriod: '14d',
  // },
  // }}
  // />,
  // routerContext
  // );

  // expect(eventsMock).toHaveBeenCalledWith(
  // expect.any(String),
  // expect.objectContaining({
  // query: {
  // statsPeriod: '14d',
  // },
  // })
  // );

  // eventsMock.mockClear();

  // const location = {
  // query: {
  // start: '2017-10-01T04:00:00',
  // end: '2017-10-02T03:59:59',
  // },
  // search: '?start=2017-10-01T04:00:00&end=2017-10-02T03:59:59',
  // };

  // wrapper.setContext({
  // router: {
  // ...router,
  // location,
  // },
  // });
  // wrapper.update();

  // expect(eventsMock).toHaveBeenLastCalledWith(
  // expect.any(String),
  // expect.objectContaining({
  // query: {
  // start: '2017-10-01T04:00:00',
  // end: '2017-10-02T03:59:59',
  // },
  // })
  // );
  // });

  // describe('OrganizationDashboardContainer', function() {
  // let wrapper;

  // beforeEach(function() {
  // // GlobalSelectionStore.reset();

  // router.location = {
  // pathname: '/organizations/org-slug/events/',
  // query: {},
  // };
  // wrapper = mount(
  // <OrganizationDashboardContainer
  // router={router}
  // organization={organization}
  // location={router.location}
  // >
  // <OrganizationDashboard location={router.location} organization={org} />
  // </OrganizationDashboardContainer>,
  // routerContext
  // );

  // mockRouterPush(wrapper, router);
  // });

  // it('performs the correct queries when there is a search query', async function() {
  // wrapper.find('SmartSearchBar input').simulate('change', {target: {value: 'http'}});
  // wrapper.find('SmartSearchBar input').simulate('submit');

  // expect(router.push).toHaveBeenLastCalledWith({
  // pathname: '/organizations/org-slug/events/',
  // query: {query: 'http', statsPeriod: '14d'},
  // });

  // await tick();
  // await tick();
  // wrapper.update();

  // expect(eventsMock).toHaveBeenLastCalledWith(
  // '/organizations/org-slug/events/',
  // expect.objectContaining({
  // query: {query: 'http', statsPeriod: '14d'},
  // })
  // );

  // // 28d because of previous period
  // expect(eventsStatsMock).toHaveBeenLastCalledWith(
  // '/organizations/org-slug/events-stats/',
  // expect.objectContaining({
  // query: expect.objectContaining({query: 'http', statsPeriod: '28d'}),
  // })
  // );

  // expect(eventsMetaMock).toHaveBeenLastCalledWith(
  // '/organizations/org-slug/events-meta/',
  // expect.objectContaining({
  // query: {query: 'http', statsPeriod: '14d'},
  // })
  // );
  // });
  // });
});
