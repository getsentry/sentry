import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import DashboardDetail from 'app/views/dashboardsV2/detail';

jest.mock('app/actionCreators/modal', () => ({
  openAddDashboardWidgetModal: jest.fn(),
}));

describe('Dashboards > Detail', function () {
  const organization = TestStubs.Organization({
    features: ['global-views', 'dashboards-v2', 'discover-query'],
    projects: [TestStubs.Project()],
  });

  describe('prebuilt dashboards', function () {
    let wrapper;
    let initialData;
    const route = {};

    beforeEach(function () {
      initialData = initializeOrg({organization});

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
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
        url: '/organizations/org-slug/dashboards/default-overview/',
        body: TestStubs.Dashboard([], {id: 'default-overview', title: 'Default'}),
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    it('can delete', async function () {
      const deleteMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        method: 'DELETE',
      });
      wrapper = mountWithTheme(
        <DashboardDetail
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: 'default-overview'}}
          router={initialData.router}
          route={route}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      // Click delete, request should be made.
      wrapper.find('Controls Button[data-test-id="dashboard-delete"]').simulate('click');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('can rename and save', async function () {
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        method: 'PUT',
        body: TestStubs.Dashboard([], {id: '8', title: 'Updated prebuilt'}),
      });
      wrapper = mountWithTheme(
        <DashboardDetail
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: 'default-overview'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      // Rename
      wrapper.find('DashboardTitle Input').simulate('blur', {
        target: {innerText: 'Updated prebuilt', value: 'Updated prebuilt'},
      });

      wrapper.find('Controls Button[data-test-id="dashboard-commit"]').simulate('click');
      await tick();

      expect(updateMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/default-overview/',
        expect.objectContaining({
          data: expect.objectContaining({title: 'Updated prebuilt'}),
        })
      );
      // Should redirect to the new dashboard.
      expect(browserHistory.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/dashboards/8/',
        })
      );
    });
  });

  describe('custom dashboards', function () {
    let wrapper;
    let initialData;
    let widgets;
    const route = {};

    beforeEach(function () {
      initialData = initializeOrg({organization});
      widgets = [
        TestStubs.Widget([{conditions: 'event.type:error', fields: ['count()']}], {
          title: 'Errors',
          interval: '1d',
        }),
        TestStubs.Widget([{conditions: 'event.type:transaction', fields: ['count()']}], {
          title: 'Transactions',
          interval: '1d',
        }),
      ];

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
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
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(widgets, {id: '1', title: 'Custom Errors'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    it('can remove widgets', async function () {
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
      });
      wrapper = mountWithTheme(
        <DashboardDetail
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          route={route}
          location={initialData.router.location}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      const card = wrapper.find('WidgetCard').first();
      card.find('StyledPanel').simulate('mouseOver');

      // Remove the first widget
      wrapper
        .find('WidgetCard')
        .first()
        .find('IconClick[data-test-id="widget-delete"]')
        .simulate('click');

      // Save changes
      wrapper.find('Controls Button[data-test-id="dashboard-commit"]').simulate('click');

      expect(updateMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Custom Errors',
            widgets: [widgets[1]],
          }),
        })
      );
    });

    it('can enter edit mode for widgets', async function () {
      wrapper = mountWithTheme(
        <DashboardDetail
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          route={route}
          location={initialData.router.location}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      const card = wrapper.find('WidgetCard').first();
      card.find('StyledPanel').simulate('mouseOver');

      // Edit the first widget
      wrapper
        .find('WidgetCard')
        .first()
        .find('IconClick[data-test-id="widget-edit"]')
        .simulate('click');

      await tick();
      wrapper.update();

      expect(openAddDashboardWidgetModal).toHaveBeenCalled();
      expect(openAddDashboardWidgetModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: widgets[0],
        })
      );
    });
  });
});
