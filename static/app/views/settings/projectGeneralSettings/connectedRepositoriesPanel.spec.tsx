import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConnectedRepositoriesPanel} from 'sentry/views/settings/projectGeneralSettings/connectedRepositoriesPanel';

describe('ConnectedRepositoriesPanel', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();
  const repo = RepositoryFixture({integrationId: integration.id});

  function renderPanel() {
    return render(<ConnectedRepositoriesPanel project={project} />, {organization});
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows a loading spinner while the request is in flight', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [],
    });

    renderPanel();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows empty state when no repositories are connected', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [],
    });

    renderPanel();

    expect(await screen.findByText('No repositories connected')).toBeInTheDocument();
  });

  it('renders a row with the repo name and mapping count', async () => {
    const mapping = RepositoryProjectPathConfigFixture({project, repo, integration});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [mapping],
    });

    renderPanel();

    expect(await screen.findByText(repo.name)).toBeInTheDocument();
    expect(screen.getByText('1 mapping')).toBeInTheDocument();
  });

  it('collapses multiple mappings for the same repo into one row', async () => {
    const mappingA = RepositoryProjectPathConfigFixture({
      project,
      repo,
      integration,
      id: '1',
      stackRoot: '/a',
    });
    const mappingB = RepositoryProjectPathConfigFixture({
      project,
      repo,
      integration,
      id: '2',
      stackRoot: '/b',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [mappingA, mappingB],
    });

    renderPanel();

    expect(await screen.findByText(repo.name)).toBeInTheDocument();
    expect(screen.getByText('2 mappings')).toBeInTheDocument();
    expect(screen.getAllByText(repo.name)).toHaveLength(1);
  });

  it('opens overflow menu with disabled Edit and Disconnect items', async () => {
    const mapping = RepositoryProjectPathConfigFixture({project, repo, integration});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [mapping],
    });

    renderPanel();

    await userEvent.click(await screen.findByRole('button', {name: 'More Actions'}));

    expect(screen.getByRole('menuitemradio', {name: 'Edit'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('menuitemradio', {name: 'Disconnect'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
