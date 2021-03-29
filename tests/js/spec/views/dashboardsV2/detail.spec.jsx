import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';

import DashboardDetail from 'app/views/dashboardsV2/detail';

describe('Dashboards > Detail', function () {
  const organization = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
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

      const modal = await mountGlobalModal();

      // Click delete, confirm will show
      wrapper.find('Controls Button[data-test-id="dashboard-delete"]').simulate('click');
      await tick();

      await modal.update();

      // Click confirm
      modal.find('button[aria-label="Confirm"]').simulate('click');

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

    it('disables buttons based on features', async function () {
      initialData = initializeOrg({
        organization: TestStubs.Organization({
          features: ['global-views', 'dashboards-basic', 'discover-query'],
          projects: [TestStubs.Project()],
        }),
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

      // Edit should be disabled
      const editProps = wrapper
        .find('Controls Button[data-test-id="dashboard-edit"]')
        .props();
      expect(editProps.disabled).toBe(true);

      // Create should be disabled
      const createProps = wrapper
        .find('Controls Button[data-test-id="dashboard-create"]')
        .props();
      expect(createProps.disabled).toBe(true);
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
        TestStubs.Widget(
          [{name: '', conditions: 'event.type:error', fields: ['count()']}],
          {
            title: 'Errors',
            interval: '1d',
            id: '1',
          }
        ),
        TestStubs.Widget(
          [{name: '', conditions: 'event.type:transaction', fields: ['count()']}],
          {
            title: 'Transactions',
            interval: '1d',
            id: '2',
          }
        ),
        TestStubs.Widget(
          [
            {
              name: '',
              conditions: 'event.type:transaction transaction:/api/cats',
              fields: ['p50()'],
            },
          ],
          {
            title: 'p50 of /api/cats',
            interval: '1d',
            id: '3',
          }
        ),
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

      // Remove the second and third widgets
      wrapper
        .find('WidgetCard')
        .at(1)
        .find('IconClick[data-test-id="widget-delete"]')
        .simulate('click');

      wrapper
        .find('WidgetCard')
        .at(1)
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
            widgets: [widgets[0]],
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
      await wrapper.update();
      const modal = await mountGlobalModal();

      expect(modal.find('AddDashboardWidgetModal').props().widget).toEqual(widgets[0]);
    });
  });
});
