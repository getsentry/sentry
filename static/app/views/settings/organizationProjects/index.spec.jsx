import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import OrganizationProjectsContainer from 'sentry/views/settings/organizationProjects';

describe('OrganizationProjects', function () {
  let org;
  let project;
  let projectsGetMock;
  let statsGetMock;
  let projectsPutMock;
  const routerContext = routerContext();

  beforeEach(function () {
    project = Project();
    org = Organization();

    projectsGetMock = Client.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    statsGetMock = Client.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });

    projectsPutMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('should render the projects in the store', function () {
    const {container} = render(
      <OrganizationProjectsContainer params={{orgId: org.slug}} location={{query: {}}} />
    );

    expect(container).toSnapshot();

    expect(screen.getByText('project-slug')).toBeInTheDocument();

    expect(projectsGetMock).toHaveBeenCalledTimes(1);
    expect(statsGetMock).toHaveBeenCalledTimes(1);
    expect(projectsPutMock).toHaveBeenCalledTimes(0);

    userEvent.click(screen.getByRole('button', {name: 'Bookmark Project'}));
    expect(
      screen.getByRole('button', {name: 'Bookmark Project', pressed: true})
    ).toBeInTheDocument();

    expect(projectsPutMock).toHaveBeenCalledTimes(1);
  });

  it('should search organization projects', function () {
    const searchMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    render(
      <OrganizationProjectsContainer location={{query: {}}} params={{orgId: org.slug}} />,
      {context: routerContext}
    );

    const searchBox = screen.getByRole('textbox');

    userEvent.type(searchBox, project.slug);

    expect(searchMock).toHaveBeenLastCalledWith(
      `/organizations/${org.slug}/projects/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          query: project.slug,
        },
      })
    );

    userEvent.type(searchBox, '{enter}');
    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });
});
