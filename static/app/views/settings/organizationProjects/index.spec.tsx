import {Project} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationProjectsContainer from 'sentry/views/settings/organizationProjects';

describe('OrganizationProjects', function () {
  let projectsGetMock: jest.Mock;
  let statsGetMock: jest.Mock;
  let projectsPutMock: jest.Mock;
  const project = Project();
  const {routerContext} = initializeOrg();

  beforeEach(function () {
    projectsGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    statsGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });

    projectsPutMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('should render the projects in the store', async function () {
    render(<OrganizationProjectsContainer />);

    expect(await screen.findByText('project-slug')).toBeInTheDocument();

    expect(projectsGetMock).toHaveBeenCalledTimes(1);
    expect(statsGetMock).toHaveBeenCalledTimes(1);
    expect(projectsPutMock).toHaveBeenCalledTimes(0);

    await userEvent.click(await screen.findByRole('button', {name: 'Bookmark Project'}));
    expect(
      await screen.findByRole('button', {name: 'Bookmark Project', pressed: true})
    ).toBeInTheDocument();

    expect(projectsPutMock).toHaveBeenCalledTimes(1);
  });

  it('should search organization projects', async function () {
    jest.useFakeTimers();
    render(<OrganizationProjectsContainer />, {
      context: routerContext,
    });

    expect(await screen.findByText('project-slug')).toBeInTheDocument();

    MockApiClient.clearMockResponses();
    const searchQuery = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    const searchBox = await screen.findByRole('textbox');
    await userEvent.type(searchBox, 'random');

    jest.runAllTimers();

    expect(await screen.findByText('No projects found.')).toBeInTheDocument();
    expect(searchQuery).toHaveBeenCalledWith(
      `/organizations/org-slug/projects/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          query: 'random',
        },
      })
    );
  });
});
