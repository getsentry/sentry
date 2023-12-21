import {Dashboard as DashboardFixture} from 'sentry-fixture/dashboard';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import CreateDashboard from 'sentry/views/dashboards/create';

describe('Dashboards > Create', function () {
  const organization = Organization({
    features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
  });

  describe('new dashboards', function () {
    let initialData;
    const projects = [ProjectFixture()];

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
        body: [ProjectFixture()],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [DashboardFixture([], {id: 'default-overview', title: 'Default'})],
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
        body: DashboardFixture([], {id: '1', title: 'Custom Errors'}),
      });

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
      renderGlobalModal({context: initialData.routerContext});

      await userEvent.click(await screen.findByTestId('widget-add'));

      // Add a custom widget to the dashboard
      await userEvent.click(await screen.findByText('Custom Widget'));
      await userEvent.click(screen.getByTestId('widget-title-input'));
      await userEvent.paste('Widget Title');
      await userEvent.click(screen.getByText('Save'));

      // Committing dashboard should complete without throwing error
      await userEvent.click(screen.getByText('Save and Finish'));
    });
  });
});
