import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import * as analytics from 'sentry/utils/analytics';

import RepositoryProjectPathConfigModal from './repositoryProjectPathConfigForm';

describe('RepositoryProjectPathConfigModal', () => {
  const organization = OrganizationFixture();
  const integration = GitHubIntegrationFixture();
  const projects = [
    ProjectFixture({id: '1', slug: 'project-a', name: 'Project A'}),
    ProjectFixture({id: '2', slug: 'project-b', name: 'Project B'}),
  ];
  const repos = [
    RepositoryFixture({id: '10', name: 'org/repo-one'}),
    RepositoryFixture({id: '20', name: 'org/repo-two'}),
  ];

  const closeModal = jest.fn();

  const modalProps = {
    Body: ModalBody,
    Header: makeClosableHeader(jest.fn()),
    Footer: ModalFooter,
    CloseButton: makeCloseButton(jest.fn()),
    closeModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    // Integration repos query for auto-fill
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      body: {repos: []},
    });
  });

  it('renders all fields with default values in create mode', () => {
    render(
      <RepositoryProjectPathConfigModal
        {...modalProps}
        organization={organization}
        integration={integration}
        projects={projects}
        repos={repos}
      />
    );

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Repo')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('main');
    expect(screen.getByRole('textbox', {name: 'Stack Trace Root'})).toHaveValue('');
    expect(screen.getByRole('textbox', {name: 'Source Code Root'})).toHaveValue('');
  });

  it('renders with existing config values in update mode', () => {
    const existingConfig = RepositoryProjectPathConfigFixture({
      id: '99',
      project: projects[0]!,
      repo: repos[0]!,
      integration,
      defaultBranch: 'develop',
      stackRoot: 'app/',
      sourceRoot: 'src/app/',
    });

    render(
      <RepositoryProjectPathConfigModal
        {...modalProps}
        organization={organization}
        integration={integration}
        projects={projects}
        repos={repos}
        existingConfig={existingConfig}
      />
    );

    expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('develop');
    expect(screen.getByRole('textbox', {name: 'Stack Trace Root'})).toHaveValue('app/');
    expect(screen.getByRole('textbox', {name: 'Source Code Root'})).toHaveValue(
      'src/app/'
    );
  });

  it('POSTs to code-mappings endpoint in create mode', async () => {
    jest.spyOn(analytics, 'trackAnalytics');
    const mockPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'POST',
      body: {},
    });

    render(
      <RepositoryProjectPathConfigModal
        {...modalProps}
        organization={organization}
        integration={integration}
        projects={projects}
        repos={repos}
      />
    );

    // Select project
    await userEvent.click(screen.getByRole('textbox', {name: 'Project'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'project-a'}));

    // Select repo
    await userEvent.click(screen.getByRole('textbox', {name: 'Repo'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'org/repo-one'}));

    // Submit
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/code-mappings/`,
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: '1',
            repositoryId: '10',
            defaultBranch: 'main',
            stackRoot: '',
            sourceRoot: '',
            integrationId: integration.id,
          }),
          method: 'POST',
        })
      );
    });

    expect(analytics.trackAnalytics).toHaveBeenCalledWith(
      'integrations.stacktrace_submit_config',
      expect.objectContaining({
        setup_type: 'manual',
        provider: integration.provider.key,
      })
    );
  });

  it('PUTs to code-mappings endpoint in update mode', async () => {
    const existingConfig = RepositoryProjectPathConfigFixture({
      id: '99',
      project: projects[0]!,
      repo: repos[0]!,
      integration,
      defaultBranch: 'develop',
      stackRoot: 'app/',
      sourceRoot: 'src/app/',
    });

    const mockPut = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/99/`,
      method: 'PUT',
      body: {},
    });

    render(
      <RepositoryProjectPathConfigModal
        {...modalProps}
        organization={organization}
        integration={integration}
        projects={projects}
        repos={repos}
        existingConfig={existingConfig}
      />
    );

    // Change the branch
    const branchInput = screen.getByRole('textbox', {name: 'Branch'});
    await userEvent.clear(branchInput);
    await userEvent.type(branchInput, 'release');

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/code-mappings/99/`,
        expect.objectContaining({
          data: expect.objectContaining({
            defaultBranch: 'release',
          }),
          method: 'PUT',
        })
      );
    });
  });

  it('auto-fills defaultBranch when repo is selected', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      body: {
        repos: [{identifier: 'org/repo-one', defaultBranch: 'trunk'}],
      },
      match: [MockApiClient.matchQuery({search: 'org/repo-one'})],
    });

    render(
      <RepositoryProjectPathConfigModal
        {...modalProps}
        organization={organization}
        integration={integration}
        projects={projects}
        repos={repos}
      />
    );

    // Select a repo
    await userEvent.click(screen.getByRole('textbox', {name: 'Repo'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'org/repo-one'}));

    // Branch should be auto-filled
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('trunk');
    });
  });

  it('does not override manually changed branch when repo is selected', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      body: {
        repos: [{identifier: 'org/repo-one', defaultBranch: 'trunk'}],
      },
      match: [MockApiClient.matchQuery({search: 'org/repo-one'})],
    });

    render(
      <RepositoryProjectPathConfigModal
        {...modalProps}
        organization={organization}
        integration={integration}
        projects={projects}
        repos={repos}
      />
    );

    // Manually change the branch first
    const branchInput = screen.getByRole('textbox', {name: 'Branch'});
    await userEvent.clear(branchInput);
    await userEvent.type(branchInput, 'my-custom-branch');

    // Now select a repo
    await userEvent.click(screen.getByRole('textbox', {name: 'Repo'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'org/repo-one'}));

    // Branch should keep the manually entered value
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue(
        'my-custom-branch'
      );
    });
  });
});
