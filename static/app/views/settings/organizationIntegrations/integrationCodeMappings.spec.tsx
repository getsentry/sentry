import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {IntegrationCodeMappings} from 'sentry/views/settings/organizationIntegrations/integrationCodeMappings';

describe('IntegrationCodeMappings', () => {
  const projects = [
    ProjectFixture(),
    ProjectFixture({
      id: '3',
      slug: 'some-project',
      name: 'Some Project',
    }),
  ];

  const org = OrganizationFixture();
  const integration = GitHubIntegrationFixture();
  const repos = [
    RepositoryFixture({
      integrationId: integration.id,
    }),

    RepositoryFixture({
      integrationId: integration.id,
      id: '5',
      name: 'example/hello-there',
    }),
  ];

  const pathConfig1 = RepositoryProjectPathConfigFixture({
    project: projects[0]!,
    repo: repos[0]!,
    integration,
    stackRoot: 'stack/root',
    sourceRoot: 'source/root',
  });

  const pathConfig2 = RepositoryProjectPathConfigFixture({
    project: projects[1]!,
    repo: repos[1]!,
    integration,
    id: '12',
    stackRoot: 'one/path',
    sourceRoot: 'another/root',
  });

  beforeEach(() => {
    ProjectsStore.loadInitialData(projects);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      body: [pathConfig1, pathConfig2],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/repos/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
      body: {repos: []},
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('shows the paths', async () => {
    render(<IntegrationCodeMappings integration={integration} />);

    expect(await screen.findByText(repos[0]!.name)).toBeInTheDocument();
    for (const repo of repos.slice(1)) {
      expect(screen.getByText(repo.name)).toBeInTheDocument();
    }
  });

  it('renders each code mapping in column order when the mappings load', async () => {
    render(<IntegrationCodeMappings integration={integration} />);

    const table = screen.getByRole('table', {name: 'Code Mappings'});
    const row = await within(table).findByRole('row', {name: /stack\/root/});

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual([
      'Code Mappings',
      'Stack Trace Root',
      'Source Code Root',
      'Add Code Mapping',
    ]);
    expect(
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual([
      `${pathConfig1.repoName}${projects[0]!.slug}\u00A0|\u00A0${pathConfig1.defaultBranch}`,
      'stack/root',
      'source/root',
      '',
    ]);
    expect(within(table).getByRole('row', {name: /one\/path/})).toBeInTheDocument();
  });

  it('renders an empty message when there are no code mappings', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      body: [],
    });

    render(<IntegrationCodeMappings integration={integration} />);

    expect(
      await screen.findByText('Set up stack trace linking by adding a code mapping.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Documentation'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Code Mapping'})).toBeEnabled();
  });

  it('renders an error with a retry when the code mappings request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      statusCode: 500,
    });

    render(<IntegrationCodeMappings integration={integration} />);

    const table = screen.getByRole('table', {name: 'Code Mappings'});

    expect(
      await within(table).findByText('Error loading code mappings')
    ).toBeInTheDocument();
    expect(within(table).getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(within(table).getByRole('button', {name: 'Add Code Mapping'})).toBeDisabled();
  });

  it('create new config', async () => {
    const stackRoot = 'my/root';
    const sourceRoot = 'hey/dude';
    const defaultBranch = 'release';
    const url = `/organizations/${org.slug}/code-mappings/`;
    const createMock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: RepositoryProjectPathConfigFixture({
        project: projects[1]!,
        repo: repos[1]!,
        integration,
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    render(<IntegrationCodeMappings integration={integration} />);
    const {waitForModalToHide} = renderGlobalModal();

    await screen.findByText(pathConfig1.repoName);
    await userEvent.click(screen.getByRole('button', {name: 'Add Code Mapping'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await selectEvent.select(
      screen.getByText('Choose Sentry project'),
      projects[1]!.slug
    );
    await selectEvent.select(screen.getByText('Choose repo'), repos[1]!.name);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Stack Trace Root'}),
      stackRoot
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Source Code Root'}),
      sourceRoot
    );
    await userEvent.clear(screen.getByRole('textbox', {name: 'Branch'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Branch'}), defaultBranch);
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitForModalToHide();

    expect(createMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: projects[1]!.id,
          repositoryId: repos[1]!.id,
          stackRoot,
          sourceRoot,
          defaultBranch,
          integrationId: integration.id,
        }),
      })
    );
  });

  it('edit existing config', async () => {
    const stackRoot = 'new/root';
    const sourceRoot = 'source/root';
    const defaultBranch = 'master';
    const url = `/organizations/${org.slug}/code-mappings/${pathConfig1.id}/`;
    const editMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: RepositoryProjectPathConfigFixture({
        project: projects[0]!,
        repo: repos[0]!,
        integration,
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    render(<IntegrationCodeMappings integration={integration} />);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click((await screen.findAllByRole('button', {name: 'edit'}))[0]!);
    await userEvent.clear(screen.getByRole('textbox', {name: 'Stack Trace Root'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Stack Trace Root'}),
      stackRoot
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitForModalToHide();

    expect(editMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({
          defaultBranch,
          projectId: '2',
          repositoryId: '4',
          sourceRoot,
          stackRoot,
        }),
      })
    );
  });

  it('switches default branch to the repo defaultBranch', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
      body: {
        repos: [
          {
            id: repos[0]!.id,
            identifier: repos[1]!.name,
            defaultBranch: 'main',
          },
        ],
      },
    });
    render(<IntegrationCodeMappings integration={integration} />);
    renderGlobalModal();

    await screen.findByText(pathConfig1.repoName);
    await userEvent.click(screen.getByRole('button', {name: 'Add Code Mapping'}));
    expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('main');

    await selectEvent.select(screen.getByText('Choose repo'), repos[1]!.name);
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('main');
    });
  });

  it('deletes existing config and refreshes data', async () => {
    const deleteUrl = `/organizations/${org.slug}/code-mappings/${pathConfig1.id}/`;
    const deleteMock = MockApiClient.addMockResponse({
      url: deleteUrl,
      method: 'DELETE',
    });

    render(<IntegrationCodeMappings integration={integration} />);
    renderGlobalModal();

    // Should show both path configs initially
    expect(await screen.findByText(pathConfig1.repoName)).toBeInTheDocument();
    expect(screen.getByText(pathConfig2.repoName)).toBeInTheDocument();

    // Override mock before refetch happens after delete
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      body: [pathConfig2], // Only pathConfig2 remains after delete
    });

    // Click delete button for first config
    await userEvent.click(screen.getAllByRole('button', {name: 'delete'})[0]!);
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());

    expect(screen.queryByText(pathConfig1.repoName)).not.toBeInTheDocument();
    expect(screen.getByText(pathConfig2.repoName)).toBeInTheDocument();
  });
});
