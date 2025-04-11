import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutofixRepos} from 'sentry/components/events/autofix/useAutofix';
import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';

jest.mock('sentry/components/events/autofix/useAutofix');

describe('SeerNotices', function () {
  // Helper function to create repository objects
  const createRepository = (overrides = {}) => ({
    external_id: 'repo-123',
    name: 'org/repo',
    owner: 'org',
    provider: 'github',
    provider_raw: 'github',
    is_readable: true,
    is_writeable: true,
    ...overrides,
  });

  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${project.organization.slug}/${project.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: null,
      },
    });

    // Reset mock before each test
    jest.mocked(useAutofixRepos).mockReset();
  });

  it('renders nothing when all repositories are readable', function () {
    const repositories = [createRepository(), createRepository({name: 'org/repo2'})];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    const {container} = render(
      <SeerNotices groupId="123" hasGithubIntegration project={project} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders GitHub integration setup card when hasGithubIntegration is false', function () {
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [createRepository()],
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration={false} project={project} />);

    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();

    // Test for text fragments with formatting
    expect(screen.getByText(/Autofix is/, {exact: false})).toBeInTheDocument();
    expect(screen.getByText('a lot better')).toBeInTheDocument();
    expect(
      screen.getByText(/when it has your codebase as context/, {exact: false})
    ).toBeInTheDocument();

    // Test for text with links
    expect(screen.getByText(/Set up the/, {exact: false})).toBeInTheDocument();
    expect(screen.getByText('GitHub Integration', {selector: 'a'})).toBeInTheDocument();
    expect(
      screen.getByText(/to allow Autofix to go deeper/, {exact: false})
    ).toBeInTheDocument();

    expect(screen.getByText('Set Up Now')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Install'})).toBeInTheDocument();
  });

  it('renders warning for a single unreadable GitHub repository', function () {
    const repositories = [createRepository({is_readable: false})];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    expect(screen.getByText(/Autofix can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/repo')).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
  });

  it('renders warning for a single unreadable non-GitHub repository', function () {
    const repositories = [
      createRepository({is_readable: false, provider: 'gitlab', name: 'org/gitlab-repo'}),
    ];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    expect(screen.getByText(/Autofix can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/gitlab-repo')).toBeInTheDocument();
    expect(
      screen.getByText(/It currently only supports GitHub repositories/)
    ).toBeInTheDocument();
  });

  it('renders warning for multiple unreadable repositories (all GitHub)', function () {
    const repositories = [
      createRepository({is_readable: false, name: 'org/repo1'}),
      createRepository({is_readable: false, name: 'org/repo2'}),
    ];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/repo1, org/repo2')).toBeInTheDocument();
    expect(screen.getByText(/For best performance, enable the/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
  });

  it('renders warning for multiple unreadable repositories (all non-GitHub)', function () {
    const repositories = [
      createRepository({
        is_readable: false,
        provider: 'gitlab',
        name: 'org/gitlab-repo1',
      }),
      createRepository({
        is_readable: false,
        provider: 'bitbucket',
        name: 'org/bitbucket-repo2',
      }),
    ];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/gitlab-repo1, org/bitbucket-repo2')).toBeInTheDocument();
    expect(
      screen.getByText(/Autofix currently only supports GitHub repositories/)
    ).toBeInTheDocument();
  });

  it('renders warning for multiple unreadable repositories (mixed GitHub and non-GitHub)', function () {
    const repositories = [
      createRepository({is_readable: false, name: 'org/github-repo'}),
      createRepository({is_readable: false, provider: 'gitlab', name: 'org/gitlab-repo'}),
    ];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/github-repo, org/gitlab-repo')).toBeInTheDocument();
    expect(screen.getByText(/For best performance, enable the/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
    expect(
      screen.getByText(/Autofix currently only supports GitHub repositories/)
    ).toBeInTheDocument();
  });

  it('renders warning for unreadable repositories along with GitHub setup card when no GitHub integration', function () {
    const repositories = [
      createRepository({is_readable: false, name: 'org/repo1'}),
      createRepository({is_readable: false, name: 'org/repo2'}),
    ];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration={false} project={project} />);

    // GitHub setup card
    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();

    // Unreadable repos warning
    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/repo1, org/repo2')).toBeInTheDocument();
  });

  it('renders GitHub integration link correctly', function () {
    const repositories = [createRepository({is_readable: false, name: 'org/repo1'})];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    const integrationLink = screen.getByText('GitHub integration');
    expect(integrationLink).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/github/'
    );
  });

  it('combines multiple notices when necessary', function () {
    const repositories = [
      createRepository({is_readable: false, name: 'org/repo1'}),
      createRepository({is_readable: false, name: 'org/repo2'}),
    ];
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: repositories,
      codebases: {},
    });

    render(<SeerNotices groupId="123" hasGithubIntegration={false} project={project} />);

    // Should have both the GitHub setup card and the unreadable repos warning
    const setupCard = screen.getByText('Set Up the GitHub Integration').closest('div');
    const warningAlert = screen
      .getByText(/Autofix can't access these repositories:/)
      .closest('div');

    expect(setupCard).toBeInTheDocument();
    expect(warningAlert).toBeInTheDocument();
    expect(setupCard).not.toBe(warningAlert);
  });

  it('renders repository selection card when no repos are selected but GitHub integration is enabled', async function () {
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [],
      codebases: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${project.organization.slug}/${project.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: null,
        preference: null,
      },
    });

    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />);

    await waitFor(() => {
      expect(screen.getByText('Pick Repositories to Work In')).toBeInTheDocument();
    });
  });
});
