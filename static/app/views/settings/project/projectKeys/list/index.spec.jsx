import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitForElementToBeRemoved,
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

  it('renders empty', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });

    render(
      <ProjectKeys routes={[]} params={{projectId: project.slug}} organization={org} />
    );

    expect(
      screen.getByText('There are no keys active for this project.')
    ).toBeInTheDocument();
  });

  it('has clippable box', async function () {
    render(
      <ProjectKeys
        routes={[]}
        organization={org}
        params={{projectId: project.slug}}
        project={TestStubs.Project()}
      />
    );

    const expandButton = screen.getByRole('button', {name: 'Expand'});
    await userEvent.click(expandButton);

    expect(expandButton).not.toBeInTheDocument();
  });

  it('deletes key', async function () {
    render(
      <ProjectKeys
        routes={[]}
        organization={org}
        params={{projectId: project.slug}}
        project={TestStubs.Project()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('disable and enables key', async function () {
    render(
      <ProjectKeys
        routes={[]}
        organization={org}
        params={{projectId: project.slug}}
        project={TestStubs.Project()}
      />
    );

    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'PUT',
    });

    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Disable'}));
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitForElementToBeRemoved(() => screen.getByRole('dialog'));

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: false},
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Enable'}));
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: true},
      })
    );
  });
});
