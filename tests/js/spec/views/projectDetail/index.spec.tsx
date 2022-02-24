import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import ProjectDetails from 'sentry/views/projectDetail/projectDetail';

describe('ProjectDetail', function () {
  const {routerContext, organization, project, router} = initializeOrg();
  const params = {...router.params, projectId: project.slug};

  beforeEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error = jest.fn();

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
        {context: routerContext, organization}
      );

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
        {context: routerContext, organization}
      );

      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            'Event Processing for this project is currently degraded. Events may appear with larger delays than usual or get dropped. Please check the Status page for a potential outage.'
          )
        )
      ).toBeInTheDocument();
    });
  });
});
