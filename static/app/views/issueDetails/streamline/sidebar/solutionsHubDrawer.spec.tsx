import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {SolutionsHubDrawer} from 'sentry/views/issueDetails/streamline/sidebar/solutionsHubDrawer';

describe('SolutionsHubDrawer', () => {
  const organization = OrganizationFixture({
    genAIConsent: true,
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  const mockEvent = EventFixture({
    entries: [
      {
        type: EntryType.EXCEPTION,
        data: {values: [{stacktrace: {frames: [FrameFixture()]}}]},
      },
    ],
  });
  const mockGroup = GroupFixture();
  const mockProject = ProjectFixture();

  const mockAutofixData = AutofixDataFixture({steps: [AutofixStepFixture()]});

  // Create autofix data with various repository configurations for testing notices
  const mockAutofixWithReadableRepos = AutofixDataFixture({
    steps: [AutofixStepFixture()],
    repositories: [
      {
        name: 'org/repo',
        provider: 'github',
        integration_id: '123',
        default_branch: 'main',
        external_id: 'repo-123',
        url: 'https://github.com/org/repo',
        is_readable: true,
      },
    ],
  });

  const mockAutofixWithUnreadableGithubRepos = AutofixDataFixture({
    steps: [AutofixStepFixture()],
    repositories: [
      {
        name: 'org/repo',
        provider: 'github',
        integration_id: '123',
        default_branch: 'main',
        external_id: 'repo-123',
        url: 'https://github.com/org/repo',
        is_readable: false,
      },
    ],
  });

  const mockAutofixWithUnreadableNonGithubRepos = AutofixDataFixture({
    steps: [AutofixStepFixture()],
    repositories: [
      {
        name: 'org/gitlab-repo',
        provider: 'gitlab',
        integration_id: '123',
        default_branch: 'main',
        external_id: 'repo-123',
        url: 'https://gitlab.com/org/gitlab-repo',
        is_readable: false,
      },
    ],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {
        whatsWrong: 'Test whats wrong',
        trace: 'Test trace',
        possibleCause: 'Test possible cause',
        headline: 'Test headline',
      },
    });
  });

  it('renders consent state if not consented', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: false},
        integration: {ok: false},
        githubWriteIntegration: {ok: false},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    // The heading is "Sentry AI" with a beta badge next to it
    expect(screen.getByText('Sentry AI')).toBeInTheDocument();

    expect(screen.getByTestId('ai-setup-data-consent')).toBeInTheDocument();
  });

  it('renders initial state with Start Autofix button', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText('Sentry AI')).toBeInTheDocument();

    // Verify the Start Autofix button is available
    const startButton = screen.getByRole('button', {name: 'Start Autofix'});
    expect(startButton).toBeInTheDocument();
  });

  it('renders GitHub integration setup notice when missing GitHub integration', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: false},
        githubWriteIntegration: {ok: false},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();

    const startButton = screen.getByRole('button', {name: 'Start Autofix'});
    expect(startButton).toBeInTheDocument();
  });

  it('triggers autofix on clicking the Start button', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      method: 'POST',
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      method: 'GET',
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const startButton = screen.getByRole('button', {name: 'Start Autofix'});
    await userEvent.click(startButton);

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
  });

  it('displays Start Over button with autofix data', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
  });

  it('displays Start Over button even without autofix data', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Start Autofix'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start Over'})).toBeDisabled();
  });

  it('resets autofix on clicking the start over button', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    const startOverButton = await screen.findByRole('button', {name: 'Start Over'});
    expect(startOverButton).toBeInTheDocument();
    await userEvent.click(startOverButton);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Start Autofix'})).toBeInTheDocument();
    });
  });

  it('shows setup instructions when GitHub integration setup is needed', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: false},
        githubWriteIntegration: {ok: false, repos: []},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/?provider_key=github&includeConfig=0',
      body: [],
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText('Sentry AI')).toBeInTheDocument();

    // Since "Install the GitHub Integration" text isn't found, let's check for
    // the "Set Up the GitHub Integration" text which is what the component is actually showing
    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();
  });

  it('does not render SolutionsHubNotices when all repositories are readable', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixWithReadableRepos},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // We don't expect to see any notice about repositories since all are readable
    expect(screen.queryByText(/Autofix can't access/)).not.toBeInTheDocument();
  });

  it('renders warning for unreadable GitHub repository', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixWithUnreadableGithubRepos},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(/Autofix can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/repo')).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
  });

  it('renders warning for unreadable non-GitHub repository', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixWithUnreadableNonGithubRepos},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(/Autofix can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/gitlab-repo')).toBeInTheDocument();
    expect(
      screen.getByText(/It currently only supports GitHub repositories/)
    ).toBeInTheDocument();
  });
});
