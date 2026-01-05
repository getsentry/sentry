import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import * as pageFilters from 'sentry/actionCreators/pageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';

import ProjectDetail from './projectDetail';
import ProjectDetailContainer from './';

jest.mock('sentry/actionCreators/organization');

describe('ProjectDetail', () => {
  const {organization, projects} = initializeOrg();
  const project = projects[0]!;

  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/projects/${project.slug}/`,
    },
    route: '/organizations/:orgId/projects/:projectId/',
  };

  function setupMockResponses() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sent-first-event/`,
      body: {sentFirstEvent: true},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=5&project=${project.id}&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/?project=${project.id}&query=is%3Aunresolved%20is%3Afor_review&query=&query=is%3Aresolved&query=error.unhandled%3Atrue%20is%3Aunresolved&query=regressed_in_release%3Alatest&statsPeriod=14d`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [],
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.init();
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('Render an error if project not found', async () => {
    ProjectsStore.loadInitialData([{...project, slug: 'different-slug'}]);

    render(<ProjectDetail />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByText(/project could not be found/)).toBeInTheDocument();

    // By clicking on the retry button, we should attempt to fetch the organization details again
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(fetchOrganizationDetails).toHaveBeenCalledWith(
      expect.any(MockApiClient),
      organization.slug
    );
  });

  it('Render warning if user is not a member of the project', async () => {
    ProjectsStore.loadInitialData([{...project, hasAccess: false}]);

    render(<ProjectDetail />, {
      organization,
      initialRouterConfig,
    });

    expect(
      await screen.findByText(/ask an admin to add your team to this project/i)
    ).toBeInTheDocument();
  });

  it('Render project details', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();

    render(<ProjectDetail />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByText(/project details/i)).toBeInTheDocument();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
  });

  it('Render deprecation dialog', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();

    render(<ProjectDetailContainer />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByText(/similar charts are available/i)).toBeInTheDocument();
  });

  it('Sync project with slug', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();
    jest.spyOn(pageFilters, 'updateProjects');

    render(<ProjectDetail />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/${project.slug}/`,
          query: {project: 'different-slug'},
        },
        route: '/organizations/:orgId/projects/:projectId/',
      },
    });

    await waitFor(() => {
      expect(pageFilters.updateProjects).toHaveBeenCalledWith(
        [Number(project.id)],
        expect.objectContaining({
          location: expect.objectContaining({
            pathname: `/organizations/${organization.slug}/projects/${project.slug}/`,
            query: {project: 'different-slug'},
          }),
        })
      );
    });
  });
});
