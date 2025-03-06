import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import ProjectDetails from 'sentry/views/projectDetail/projectDetail';

describe('ProjectDetail', function () {
  const {organization, project, router} = initializeOrg();
  const params = {...router.params, projectId: project.slug} as any;

  beforeEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();

    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
  });

  describe('project low priority queue alert', function () {
    it('does not render alert', function () {
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

      render(
        <ProjectDetails
          organization={organization}
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />,
        {
          router,
          organization,
        }
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

      render(
        <ProjectDetails
          organization={organization}
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />,
        {
          router,
          organization,
        }
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
