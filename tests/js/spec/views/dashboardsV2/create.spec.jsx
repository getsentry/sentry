import React from 'react';
import {act} from 'react-dom/test-utils';
import {browserHistory} from 'react-router';

import {createListeners} from 'sentry-test/createListeners';
import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import CreateDasboard from 'app/views/dashboardsV2/create';

const FEATURES = [
  'global-views',
  'dashboards-basic',
  'dashboards-edit',
  'discover-query',
  'dashboards-manage',
];

describe('New Dashboard Page', function () {
  // const mockUnauthorizedOrg = TestStubs.Organization({
  //   features: ['dashboards-basic'],
  // });

  const initialData = initializeOrg({
    organization: {
      features: FEATURES,
    },
    router: {
      params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
    },
  });

  let createMock;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      statusCode: 200,
      body: {id: 1},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [TestStubs.Project()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        TestStubs.Dashboard([], {id: 'default-overview', title: 'Default'}),
        TestStubs.Dashboard([], {id: '1', title: 'Custom Errors'}),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: []},
    });
  });

  it('denies access on missing feature', function () {
    const mockUnauthorizedOrg = TestStubs.Organization({
      features: ['global-views', 'dashboards-basic'],
    });

    const wrapper = mountWithTheme(
      <CreateDasboard
        organization={mockUnauthorizedOrg}
        location={{query: {}}}
        router={TestStubs.router()}
        route={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('PageContent');
    expect(content.text()).toContain("You don't have access to this feature");
  });

  it('denies access on no projects', function () {
    const mockAuthorizedOrg = TestStubs.Organization({
      features: FEATURES,
    });
    const wrapper = mountWithTheme(
      <CreateDasboard
        organization={mockAuthorizedOrg}
        location={{query: {}}}
        router={TestStubs.router()}
        route={{}}
      />,
      TestStubs.routerContext()
    );
    wrapper.update();

    const content = wrapper.find('DocumentTitle');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('can save', async function () {
    const fireEvent = createListeners('window');
    const wrapper = mountWithTheme(
      <CreateDasboard
        organization={initialData.organization}
        params={{orgId: 'org-slug'}}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );

    await tick();
    wrapper.update();

    // Rename
    const dashboardTitle = wrapper.find('DashboardTitle Label');
    dashboardTitle.simulate('click');

    wrapper.find('StyledInput').simulate('change', {
      target: {innerText: 'Updated Title', value: 'Updated Title'},
    });

    act(() => {
      // Press enter
      fireEvent.keyDown('Enter');
    });

    wrapper.find('Controls Button[data-test-id="dashboard-commit"]').simulate('click');
    await tick();

    expect(createMock).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/',
      expect.objectContaining({
        data: expect.objectContaining({title: 'Updated Title'}),
      })
    );

    expect(browserHistory.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/1/',
      })
    );
  });

  it('can cancel', async function () {
    const wrapper = mountWithTheme(
      <CreateDasboard
        organization={initialData.organization}
        params={{orgId: 'org-slug'}}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );

    await tick();
    wrapper.update();

    // Rename
    wrapper.find('Controls Button[data-test-id="dashboard-cancel"]').simulate('click');
    await tick();

    expect(browserHistory.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/',
      })
    );
  });
});
