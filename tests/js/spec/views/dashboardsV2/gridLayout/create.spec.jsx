import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import CreateDashboard from 'sentry/views/dashboardsV2/create';

describe('Dashboards > Create', function () {
  enforceActOnUseLegacyStoreHook();
  const organization = TestStubs.Organization({
    features: [
      'dashboards-basic',
      'dashboards-edit',
      'discover-query',
      'dashboard-grid-layout',
      'widget-library',
    ],
  });

  describe('new dashboards', function () {
    let wrapper, initialData;

    const projects = [TestStubs.Project()];
    beforeEach(function () {
      act(() => ProjectsStore.loadInitialData(projects));
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
        body: [TestStubs.Dashboard([], {id: 'default-overview', title: 'Default'})],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/widgets/',
        method: 'POST',
        body: [],
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      if (wrapper) {
        wrapper.unmount();
      }
    });

    it('can create with new widget', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        method: 'POST',
        // Dashboard detail requires the number of widgets returned to match
        // the number of layouts, which is 1 in this case
        body: TestStubs.Dashboard([{}], {id: '1', title: 'Custom Errors'}),
      });
      const widgetTitle = 'Widget Title';
      wrapper = mountWithTheme(
        <CreateDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      wrapper.find('button[data-test-id="widget-add"]').simulate('click');

      const modal = await mountGlobalModal();
      await tick();
      await modal.update();

      // Add a custom widget to the dashboard
      modal.find('CustomButton').simulate('click');
      await tick();
      await tick();
      await modal.update();
      modal.find('input[name="title"]').type(widgetTitle);
      modal.find('button[data-test-id="add-widget"]').simulate('click');

      // Committing dashboard should complete without throwing error
      wrapper.find('button[data-test-id="dashboard-commit"]').simulate('click');
      await tick();
    });
  });
});
