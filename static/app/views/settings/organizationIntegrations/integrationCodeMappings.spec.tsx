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
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ModalStore from 'sentry/stores/modalStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import IntegrationCodeMappings from 'sentry/views/settings/organizationIntegrations/integrationCodeMappings';

describe('IntegrationCodeMappings', function () {
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
    ModalStore.init();
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
    // Clear the fields from the GlobalModal after every test
    ModalStore.reset();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('shows the paths', () => {
    render(<IntegrationCodeMappings organization={org} integration={integration} />);

    for (const repo of repos) {
      expect(screen.getByText(repo.name)).toBeInTheDocument();
    }
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
    render(<IntegrationCodeMappings organization={org} integration={integration} />);
    const {waitForModalToHide} = renderGlobalModal();

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
    render(<IntegrationCodeMappings organization={org} integration={integration} />);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getAllByRole('button', {name: 'edit'})[0]!);
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
    render(<IntegrationCodeMappings organization={org} integration={integration} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Add Code Mapping'}));
    expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('master');

    await selectEvent.select(screen.getByText('Choose repo'), repos[1]!.name);
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('main');
    });
  });
});
