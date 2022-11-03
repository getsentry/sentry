import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import CreateDashboard from 'sentry/views/dashboardsV2/create';

describe('Dashboards > Create', function () {
  const organization = TestStubs.Organization({
    features: [
      'dashboards-basic',
      'dashboards-edit',
      'discover-query',
      'dashboard-grid-layout',
    ],
  });

  describe('new dashboards', function () {
    let initialData;
    const projects = [TestStubs.Project()];

    beforeEach(function () {
      ProjectsStore.init();
      ProjectsStore.loadInitialData(projects);

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
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        body: {data: []},
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    // eslint-disable-next-line
    it.skip('can create with new widget', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        method: 'POST',
        // @ts-ignore
        body: TestStubs.Dashboard([], {id: '1', title: 'Custom Errors'}),
      });

      mountGlobalModal(initialData.routerContext);

      render(
        <CreateDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug'}}
          router={initialData.router}
          location={initialData.router.location}
          {...initialData.router}
        />,
        {context: initialData.routerContext}
      );

      userEvent.click(await screen.findByTestId('widget-add'));

      // Add a custom widget to the dashboard
      userEvent.click(await screen.findByText('Custom Widget'));
      userEvent.paste(screen.getByTestId('widget-title-input'), 'Widget Title');
      userEvent.click(screen.getByText('Save'));

      // Committing dashboard should complete without throwing error
      userEvent.click(screen.getByText('Save and Finish'));
    });
  });
});
