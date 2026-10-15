import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import * as pageFilters from 'sentry/components/pageFilters/actions';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ProjectDetail} from './projectDetail';

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

  // The header renders into TopBar slots, so the bar has to be mounted
  // alongside the page for the breadcrumbs and title to appear.
  function renderProjectDetail(routerConfig = initialRouterConfig) {
    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <ProjectDetail />
      </TopBar.Slot.Provider>,
      {organization, initialRouterConfig: routerConfig}
    );
  }

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
      url: `/organizations/${organization.slug}/issues/`,
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
    setupMockResponses();

    renderProjectDetail();

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

    renderProjectDetail();

    expect(
      await screen.findByText(/ask an admin to add your team to this project/i)
    ).toBeInTheDocument();
  });

  it('Render project details', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();

    renderProjectDetail();

    expect(await screen.findByText(project.slug)).toBeInTheDocument();
  });

  it('Renders the breadcrumb trail and page title', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();

    renderProjectDetail();

    const topBar = screen.getByRole('banner');
    expect(
      await within(topBar).findByRole('link', {name: 'Projects'})
    ).toBeInTheDocument();
    expect(
      within(topBar).getByRole('heading', {name: project.slug, level: 1})
    ).toBeInTheDocument();

    // The page name is the title, not the last crumb in the trail.
    const trail = within(topBar).getByRole('list');
    expect(within(trail).queryByText(project.slug)).not.toBeInTheDocument();
  });

  it('Renders the page actions in the title menu', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();

    renderProjectDetail();

    const topBar = screen.getByRole('banner');

    // The actions used to be standalone buttons beside the header.
    expect(
      within(topBar).queryByRole('button', {name: 'View All Issues'})
    ).not.toBeInTheDocument();

    await userEvent.click(
      await within(topBar).findByRole('button', {name: 'Project Actions'})
    );

    expect(
      screen.getAllByRole('menuitemradio').map(el => el.textContent?.trim())
    ).toEqual(['View All Issues', 'Create Monitor', 'Project Settings']);
    expect(screen.getByRole('menuitemradio', {name: 'Project Settings'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/`
    );
  });

  it('Sync project with slug', async () => {
    ProjectsStore.loadInitialData([project]);
    setupMockResponses();
    jest.spyOn(pageFilters, 'updateProjects');

    const {router} = renderProjectDetail({
      location: {
        pathname: `/organizations/${organization.slug}/projects/${project.slug}/`,
        query: {project: 'different-slug'},
      },
      route: '/organizations/:orgId/projects/:projectId/',
    });

    await waitFor(() => {
      expect(pageFilters.updateProjects).toHaveBeenCalledWith(
        [Number(project.id)],
        undefined,
        undefined
      );
    });

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({project: project.id})
      );
    });
  });
});
