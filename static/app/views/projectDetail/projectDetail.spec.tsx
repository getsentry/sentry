import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import * as pageFilters from 'sentry/actionCreators/pageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';
import * as useApi from 'sentry/utils/useApi';

import ProjectDetail from './projectDetail';

jest.mock('sentry/actionCreators/organization');

describe('ProjectDetail', function () {
  const {organization, router, projects} = initializeOrg();
  const project = projects[0]!;

  beforeEach(function () {
    ProjectsStore.init();
  });

  afterEach(function () {
    ProjectsStore.reset();
  });

  it('Render an error if project not found', async function () {
    ProjectsStore.loadInitialData([{...project, slug: 'slug'}]);
    const api = new MockApiClient();
    jest.spyOn(useApi, 'default').mockReturnValue(api);

    render(
      <ProjectDetail
        organization={organization}
        params={{projectId: project.id, orgId: organization.slug}}
        router={router}
        location={router.location}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />
    );

    expect(await screen.findByText(/project could not be found/)).toBeInTheDocument();

    // By clicking on the retry button, we should attempt to fetch the organization details again
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(fetchOrganizationDetails).toHaveBeenCalledWith(
      api,
      organization.slug,
      true,
      false
    );
  });

  it('Render warning if user is not a member of the project', async function () {
    ProjectsStore.loadInitialData([{...project, hasAccess: false}]);

    render(
      <ProjectDetail
        organization={organization}
        params={{projectId: project.id, orgId: organization.slug}}
        router={router}
        location={router.location}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />
    );

    expect(
      await screen.findByText(/ask an admin to add your team to this project/i)
    ).toBeInTheDocument();
  });

  it('Render project details', async function () {
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      method: 'GET',
      body: ProjectFixture(),
    });

    render(
      <ProjectDetail
        organization={organization}
        params={{projectId: project.id, orgId: organization.slug}}
        router={router}
        location={router.location}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />
    );

    expect(await screen.findByText(/project details/i)).toBeInTheDocument();
  });

  it('Sync project with slug', async function () {
    ProjectsStore.loadInitialData([project]);
    jest.spyOn(pageFilters, 'updateProjects');

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      method: 'GET',
      body: ProjectFixture(),
    });

    render(
      <ProjectDetail
        organization={organization}
        params={{projectId: project.id, orgId: organization.slug}}
        router={router}
        location={{
          ...router.location,
          query: {project: 'different-slug'},
        }}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />
    );

    await waitFor(() => {
      expect(pageFilters.updateProjects).toHaveBeenCalledWith(
        [Number(project.id)],
        router
      );
    });
  });
});
