import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectKeys from 'sentry/views/settings/project/projectKeys/list';

describe('ProjectKeys', function () {
  let org, project;
  let deleteMock;
  let projectKeys;

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    projectKeys = TestStubs.ProjectKeys();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: projectKeys,
    });
    deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'DELETE',
    });
  });

  it('renders empty', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });

    render(
      <ProjectKeys routes={[]} params={{orgId: org.slug, projectId: project.slug}} />
    );

    expect(
      screen.getByText('There are no keys active for this project.')
    ).toBeInTheDocument();
  });

  it('has clippable box', function () {
    render(
      <ProjectKeys
        routes={[]}
        params={{orgId: org.slug, projectId: project.slug}}
        project={TestStubs.Project()}
      />
    );

    const expandButton = screen.getByRole('button', {name: 'Expand'});
    userEvent.click(expandButton);

    expect(expandButton).not.toBeInTheDocument();
  });

  it('deletes key', function () {
    render(
      <ProjectKeys
        routes={[]}
        params={{orgId: org.slug, projectId: project.slug}}
        project={TestStubs.Project()}
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    renderGlobalModal();

    userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('disable and enables key', function () {
    render(
      <ProjectKeys
        routes={[]}
        params={{orgId: org.slug, projectId: project.slug}}
        project={TestStubs.Project()}
      />
    );

    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'PUT',
    });

    userEvent.click(screen.getByRole('button', {name: 'Disable'}));

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: false},
      })
    );

    userEvent.click(screen.getByRole('button', {name: 'Enable'}));

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: true},
      })
    );
  });
});
