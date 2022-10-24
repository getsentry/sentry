import selectEvent from 'react-select-event';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import IntegrationCodeMappings from 'sentry/views/organizationIntegrations/integrationCodeMappings';

describe('IntegrationCodeMappings', function () {
  const projects = [
    TestStubs.Project(),
    TestStubs.Project({
      id: '3',
      slug: 'some-project',
      name: 'Some Project',
    }),
  ];

  const org = TestStubs.Organization();
  const integration = TestStubs.GitHubIntegration();
  const repos = [
    TestStubs.Repository({
      integrationId: integration.id,
    }),

    TestStubs.Repository({
      integrationId: integration.id,
      id: '5',
      name: 'example/hello-there',
    }),
  ];

  const pathConfig1 = TestStubs.RepositoryProjectPathConfig({
    project: projects[0],
    repo: repos[0],
    integration,
    stackRoot: 'stack/root',
    sourceRoot: 'source/root',
  });

  const pathConfig2 = TestStubs.RepositoryProjectPathConfig({
    project: projects[1],
    repo: repos[1],
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
      body: TestStubs.RepositoryProjectPathConfig({
        project: projects[1],
        repo: repos[1],
        integration,
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    render(<IntegrationCodeMappings organization={org} integration={integration} />);
    renderGlobalModal();

    userEvent.click(screen.getByRole('button', {name: 'Add Code Mapping'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await selectEvent.select(screen.getByText('Choose Sentry project'), projects[1].slug);
    await selectEvent.select(screen.getByText('Choose repo'), repos[1].name);

    userEvent.type(screen.getByRole('textbox', {name: 'Stack Trace Root'}), stackRoot);
    userEvent.type(screen.getByRole('textbox', {name: 'Source Code Root'}), sourceRoot);
    userEvent.clear(screen.getByRole('textbox', {name: 'Branch'}));
    userEvent.type(screen.getByRole('textbox', {name: 'Branch'}), defaultBranch);
    userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(createMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: projects[1].id,
          repositoryId: repos[1].id,
          stackRoot,
          sourceRoot,
          defaultBranch,
          integrationId: integration.id,
        }),
      })
    );
  });

  it('edit existing config', () => {
    const stackRoot = 'new/root';
    const sourceRoot = 'source/root';
    const defaultBranch = 'master';
    const url = `/organizations/${org.slug}/code-mappings/${pathConfig1.id}/`;
    const editMock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: TestStubs.RepositoryProjectPathConfig({
        project: projects[0],
        repo: repos[0],
        integration,
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    render(<IntegrationCodeMappings organization={org} integration={integration} />);
    renderGlobalModal();

    userEvent.click(screen.getAllByRole('button', {name: 'edit'})[0]);
    userEvent.clear(screen.getByRole('textbox', {name: 'Stack Trace Root'}));
    userEvent.type(screen.getByRole('textbox', {name: 'Stack Trace Root'}), stackRoot);
    userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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
});
