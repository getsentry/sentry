import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme,
  screen,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {getByTextContent} from 'sentry-test/utils';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import ProjectsStore from 'app/stores/projectsStore';
import ProjectDetails from 'app/views/projectDetail/projectDetail';

describe('ProjectDetail', function () {
  const {routerContext, organization, project, router} = initializeOrg();
  const params = {...router.params, projectId: project.slug};

  beforeEach(() => {
    GlobalSelectionStore.reset();
    ProjectsStore.reset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
  });

  describe('project low priority queue alert', function () {
    it('does not render alert', async function () {
      const projects = [
        {
          ...project,
          eventProcessing: {
            symbolicationDegraded: false,
          },
        },
      ];

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projects,
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        body: projects[0],
      });

      ProjectsStore.loadInitialData(projects);

      mountWithTheme(
        <ProjectDetails organization={organization} {...router} params={params} />,
        {context: routerContext}
      );

      await waitForElementToBeRemoved(() => screen.getByText('Loading\u2026'));

      expect(
        screen.queryByText(
          'Event Processing for this project is currently degraded. Events may appear with larger delays than usual or get dropped.',
          {exact: false}
        )
      ).not.toBeInTheDocument();
    });

    it('renders alert', async function () {
      const projects = [
        {
          ...project,
          eventProcessing: {
            symbolicationDegraded: true,
          },
        },
      ];

      ProjectsStore.loadInitialData(projects);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projects,
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        body: projects[0],
      });

      mountWithTheme(
        <ProjectDetails organization={organization} {...router} params={params} />,
        {context: routerContext}
      );

      await waitForElementToBeRemoved(() => screen.getByText('Loading\u2026'));

      expect(
        getByTextContent(
          'Event Processing for this project is currently degraded. Events may appear with larger delays than usual or get dropped. Please check the Status page for a potential outage.'
        )
      ).toBeInTheDocument();
    });
  });
});
