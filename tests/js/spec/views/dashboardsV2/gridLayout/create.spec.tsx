import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  mountGlobalModal,
  mountWithTheme,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import CreateDashboard from 'sentry/views/dashboardsV2/create';

describe('Dashboards > Create', function () {
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
    let initialData;

    const projects = [TestStubs.Project()];
    beforeEach(function () {
      act(() => ProjectsStore.loadInitialData(projects));
      initialData = initializeOrg({
        organization,
        project: undefined,
        projects: [],
        router: {},
      });

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
        // @ts-ignore
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
    });

    it('can create with new widget', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        method: 'POST',
        // Dashboard detail requires the number of widgets returned to match
        // the number of layouts, which is 1 in this case
        // @ts-ignore
        body: TestStubs.Dashboard([{}], {id: '1', title: 'Custom Errors'}),
      });
      const widgetTitle = 'Widget Title';
      mountWithTheme(
        <CreateDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug'}}
          router={initialData.router}
          location={initialData.router.location}
          {...initialData.router}
        />,
        {context: initialData.routerContext}
      );
      await act(async () => {
        // Wrap with act because GlobalSelectionHeaderContainer triggers update
        await tick();
      });
      screen.getByTestId('widget-add').click();

      mountGlobalModal(initialData.routerContext);

      // Add a custom widget to the dashboard
      (await screen.findByText('Custom Widget')).click();
      userEvent.type(await screen.findByTestId('widget-title-input'), widgetTitle);
      screen.getByText('Save').click();

      // Committing dashboard should complete without throwing error
      screen.getByText('Save and Finish').click();
      await tick();
    });
  });
});
