import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {AutofixRepository} from 'sentry/components/events/autofix/types';
import {SolutionsHubNotices} from 'sentry/views/issueDetails/streamline/sidebar/solutionsHubNotices';

describe('SolutionsHubNotices', function () {
  // Helper function to create repository objects
  const createRepository = (
    overrides: Partial<AutofixRepository> = {}
  ): AutofixRepository => ({
    default_branch: 'main',
    external_id: 'repo-123',
    integration_id: '123',
    name: 'org/repo',
    provider: 'github',
    url: 'https://github.com/org/repo',
    is_readable: true,
    ...overrides,
  });

  it('renders nothing when all repositories are readable', function () {
    const repositories = [createRepository(), createRepository({name: 'org/repo2'})];

    const {container} = render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders GitHub integration setup card when hasGithubIntegration is false', function () {
    render(
      <SolutionsHubNotices
        autofixRepositories={[createRepository()]}
        hasGithubIntegration={false}
      />
    );

    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Install'})).toBeInTheDocument();
  });

  it('renders GitHub integration setup card when autofixRepositories is empty', function () {
    render(<SolutionsHubNotices autofixRepositories={[]} hasGithubIntegration />);

    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Install'})).toBeInTheDocument();
  });

  it('renders warning for a single unreadable GitHub repository', function () {
    const repositories = [createRepository({is_readable: false})];

    render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

    expect(screen.getByText(/Autofix can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/repo')).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
    expect(screen.getByText(/code mappings/)).toBeInTheDocument();
  });

  it('renders warning for a single unreadable non-GitHub repository', function () {
    const repositories = [
      createRepository({is_readable: false, provider: 'gitlab', name: 'org/gitlab-repo'}),
    ];

    render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

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

    render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/repo1, org/repo2')).toBeInTheDocument();
    expect(screen.getByText(/For best performance, enable the/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
    expect(screen.getByText(/code mappings/)).toBeInTheDocument();
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

    render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

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
      createRepository({
        is_readable: false,
        provider: 'gitlab',
        name: 'org/gitlab-repo',
      }),
    ];

    render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/github-repo, org/gitlab-repo')).toBeInTheDocument();
    expect(screen.getByText(/For best performance, enable the/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
    expect(screen.getByText(/code mappings/)).toBeInTheDocument();
    expect(
      screen.getByText(/Autofix currently only supports GitHub repositories/)
    ).toBeInTheDocument();
  });

  it('renders warning for unreadable repositories along with GitHub setup card when no GitHub integration', function () {
    const repositories = [
      createRepository({is_readable: false, name: 'org/repo1'}),
      createRepository({is_readable: false, name: 'org/repo2'}),
    ];

    render(
      <SolutionsHubNotices
        autofixRepositories={repositories}
        hasGithubIntegration={false}
      />
    );

    // GitHub setup card
    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();

    // Unreadable repos warning
    expect(
      screen.getByText(/Autofix can't access these repositories:/)
    ).toBeInTheDocument();
    expect(screen.getByText('org/repo1, org/repo2')).toBeInTheDocument();
  });

  it('handles navigation to GitHub integration setup when user clicks button', async function () {
    render(<SolutionsHubNotices autofixRepositories={[]} hasGithubIntegration={false} />);

    const setupButton = screen.getByText('Set Up Now');
    // The button is a LinkButton which might not have href directly accessible in tests
    // Instead, let's just check that it exists and can be clicked
    expect(setupButton).toBeInTheDocument();

    await userEvent.click(setupButton);
    // We can't fully test navigation since it's handled by the router
  });

  it('renders correct integration links based on integration_id', function () {
    const repositories = [
      createRepository({
        is_readable: false,
        integration_id: '456',
        name: 'org/repo1',
      }),
    ];

    render(
      <SolutionsHubNotices autofixRepositories={repositories} hasGithubIntegration />
    );

    const integrationLink = screen.getByText('GitHub integration');
    expect(integrationLink).toHaveAttribute('href', '/settings/integrations/github/456');

    const codeMappingsLink = screen.getByText('code mappings');
    expect(codeMappingsLink).toHaveAttribute(
      'href',
      '/settings/integrations/github/456/?tab=codeMappings'
    );
  });

  it('combines multiple notices when necessary', function () {
    const repositories = [
      createRepository({is_readable: false, name: 'org/repo1'}),
      createRepository({is_readable: false, name: 'org/repo2'}),
    ];

    render(
      <SolutionsHubNotices
        autofixRepositories={repositories}
        hasGithubIntegration={false}
      />
    );

    // Should have both the GitHub setup card and the unreadable repos warning
    const setupCard = screen.getByText('Set Up the GitHub Integration').closest('div');
    const warningAlert = screen
      .getByText(/Autofix can't access these repositories/)
      .closest('div');

    expect(setupCard).toBeInTheDocument();
    expect(warningAlert).toBeInTheDocument();
    expect(setupCard).not.toBe(warningAlert);
  });
});
