import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
import OrganizationProjectsContainer from 'sentry/views/settings/organizationProjects';

describe('OrganizationProjects', function () {
  let projectsGetMock: jest.Mock;
  let statsGetMock: jest.Mock;
  let projectsPutMock: jest.Mock;
  const project = ProjectFixture();

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
    render(<OrganizationProjectsContainer />);

    expect(await screen.findByText('project-slug')).toBeInTheDocument();

    const searchBox = await screen.findByRole('textbox');
    await userEvent.type(searchBox, 'random', {
      advanceTimers: jest.advanceTimersByTime,
    });

    jest.runAllTimers();

    expect(browserHistory.replace).toHaveBeenLastCalledWith({
      pathname: '/mock-pathname/',
      query: {query: 'random'},
    });
  });
});
