import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationProjectsContainer from 'sentry/views/settings/organizationProjects';

describe('OrganizationProjects', () => {
  let projectsGetMock: jest.Mock;
  let projectsPutMock: jest.Mock;
  const project = ProjectFixture();

  beforeEach(() => {
    projectsGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    projectsPutMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render the projects in the store', async () => {
    render(<OrganizationProjectsContainer />);

    expect(await screen.findByText('project-slug')).toBeInTheDocument();

    expect(projectsGetMock).toHaveBeenCalledTimes(1);
    expect(projectsPutMock).toHaveBeenCalledTimes(0);

    await userEvent.click(await screen.findByRole('button', {name: 'Bookmark'}));
    expect(
      await screen.findByRole('button', {name: 'Remove Bookmark', pressed: true})
    ).toBeInTheDocument();

    expect(projectsPutMock).toHaveBeenCalledTimes(1);
  });

  it('should search organization projects', async () => {
    const {router} = render(<OrganizationProjectsContainer />);

    expect(await screen.findByText('project-slug')).toBeInTheDocument();

    const searchBox = await screen.findByRole('textbox');
    await userEvent.type(searchBox, 'random');

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/mock-pathname/',
          query: expect.objectContaining({query: 'random'}),
        })
      );
    });
  });
});
