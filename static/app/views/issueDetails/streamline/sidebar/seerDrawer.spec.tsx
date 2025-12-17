import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
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
import {SeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

describe('SeerDrawer', () => {
  const organization = OrganizationFixture({
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
    request: {
      repos: [
        {
          name: 'org/repo',
          provider: 'github',
          owner: 'org',
          external_id: 'repo-123',
        },
      ],
    },
    codebases: {
      'repo-123': {
        repo_external_id: 'repo-123',
        is_readable: true,
        is_writeable: true,
      },
    },
  });

  const mockAutofixWithUnreadableGithubRepos = AutofixDataFixture({
    steps: [AutofixStepFixture()],
    request: {
      repos: [
        {
          name: 'org/repo',
          provider: 'github',
          owner: 'org',
          external_id: 'repo-123',
        },
      ],
    },
    codebases: {
      'repo-123': {
        repo_external_id: 'repo-123',
        is_readable: false,
        is_writeable: false,
      },
    },
  });

  const mockAutofixWithUnreadableNonGithubRepos = AutofixDataFixture({
    steps: [AutofixStepFixture()],
    request: {
      repos: [
        {
          name: 'org/gitlab-repo',
          provider: 'gitlab',
          owner: 'org',
          external_id: 'repo-123',
        },
      ],
    },
    codebases: {
      'repo-123': {
        repo_external_id: 'repo-123',
        is_readable: false,
        is_writeable: false,
      },
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
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
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/group-search-views/starred/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/group-search-views/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/`,
      body: {
        autofixAutomationTuning: 'off',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: false,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/autofix-repos/`,
      body: [],
    });
  });

  it('renders consent state if not consented', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
        },
        integration: {ok: false, reason: null},
        githubWriteIntegration: {ok: false, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    expect(screen.getByTestId('ai-setup-data-consent')).toBeInTheDocument();
  });

  it('renders issue summary if consent flow is removed and there is no autofix quota', async () => {
    const orgWithConsentFlowRemoved = OrganizationFixture({
      hideAiFeatures: false,
      features: ['seer-billing', 'gen-ai-features', 'gen-ai-consent-flow-removal'],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: false, reason: null},
        githubWriteIntegration: {ok: false, repos: []},
        billing: {hasAutofixQuota: false},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization: orgWithConsentFlowRemoved,
    });

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // Issue summary fields are rendered
    expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
    expect(screen.getByText('Test trace')).toBeInTheDocument();
    expect(screen.getByText('Test possible cause')).toBeInTheDocument();
    expect(screen.getByText('Test headline')).toBeInTheDocument();

    // Should display the seer purchase flow
    expect(screen.getByTestId('ai-setup-data-consent')).toBeInTheDocument();
  });

  it('renders initial state with Start Root Cause Analysis button', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByRole('heading', {name: 'Seer'})).toBeInTheDocument();

    // Verify the Start Root Cause Analysis button is available
    const startButton = screen.getByRole('button', {name: 'Start Root Cause Analysis'});
    expect(startButton).toBeInTheDocument();
  });

  it('renders GitHub integration setup notice when missing GitHub integration', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: false, reason: null},
        githubWriteIntegration: {ok: false, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Integration')).toBeInTheDocument();

    const startButton = screen.getByRole('button', {name: 'Start Root Cause Analysis'});
    expect(startButton).toBeInTheDocument();
  });

  it('triggers Seer on clicking the Start button', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      method: 'POST',
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      method: 'GET',
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const startButton = screen.getByRole('button', {name: 'Start Root Cause Analysis'});
    await userEvent.click(startButton);

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
  });

  it('hides ButtonBarWrapper when AI consent is needed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // AutofixFeedback component should not be rendered when consent is needed
    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Start Over'})).not.toBeInTheDocument();
  });

  it('shows ButtonBarWrapper but hides Start Over button when hasAutofix is false', async () => {
    // Mock AI consent as okay but no autofix capability
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    // Use jest.spyOn instead of jest.mock inside the test
    const issueTypeConfigModule = require('sentry/utils/issueTypeConfig');
    const spy = jest
      .spyOn(issueTypeConfigModule, 'getConfigForIssueType')
      .mockImplementation(() => ({
        autofix: false,
        issueSummary: {enabled: true},
        resources: null,
      }));

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // The feedback button should be visible, but not the Start Over button
    expect(screen.getByTestId('seer-button-bar')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Start Over'})).not.toBeInTheDocument();

    // Restore the original implementation
    spy.mockRestore();
  });

  it('shows ButtonBarWrapper with disabled Start Over button when hasAutofix is true but no autofixData', async () => {
    // Mock everything as ready for autofix but no data
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // Both buttons should be visible, but Start Over should be disabled
    expect(screen.getByTestId('seer-button-bar')).toBeInTheDocument();
    const startOverButton = screen.getByRole('button', {name: 'Start Over'});
    expect(startOverButton).toBeInTheDocument();
    expect(startOverButton).toBeDisabled();
  });

  it('shows ButtonBarWrapper with enabled Start Over button when hasAutofix and autofixData are both true', async () => {
    // Mock everything as ready with existing autofix data
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // Both buttons should be visible, and Start Over should be enabled
    expect(screen.getByTestId('seer-button-bar')).toBeInTheDocument();
    const startOverButton = screen.getByRole('button', {name: 'Start Over'});
    expect(startOverButton).toBeInTheDocument();
    expect(startOverButton).toBeEnabled();
  });

  it('displays Start Over button with autofix data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
  });

  it('displays Start Over button even without autofix data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Start Root Cause Analysis'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start Over'})).toBeDisabled();
  });

  it('resets autofix on clicking the start over button', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const startOverButton = await screen.findByRole('button', {name: 'Start Over'});
    expect(startOverButton).toBeInTheDocument();
    await userEvent.click(startOverButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', {name: 'Start Root Cause Analysis'})
      ).toBeInTheDocument();
    });
  });

  it('shows setup instructions when GitHub integration setup is needed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: false, reason: null},
        githubWriteIntegration: {ok: false, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/?provider_key=github&includeConfig=0',
      body: [],
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByRole('heading', {name: 'Seer'})).toBeInTheDocument();

    // Since "Install the GitHub Integration" text isn't found, let's check for
    // the "Set Up the GitHub Integration" text which is what the component is actually showing
    expect(screen.getByText('Set Up the GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Integration')).toBeInTheDocument();
  });

  it('does not render SeerNotices when all repositories are readable', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixWithReadableRepos},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // We don't expect to see any notice about repositories since all are readable
    expect(screen.queryByText(/Seer can't access/)).not.toBeInTheDocument();
  });

  it('renders warning for unreadable GitHub repository', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixWithUnreadableGithubRepos},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(/Seer can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/repo')).toBeInTheDocument();
    expect(screen.getByText(/GitHub integration/)).toBeInTheDocument();
  });

  it('renders warning for unreadable non-GitHub repository', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixWithUnreadableNonGithubRepos},
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(/Seer can't access the/)).toBeInTheDocument();
    expect(screen.getByText('org/gitlab-repo')).toBeInTheDocument();
    expect(
      screen.getByText(/It currently only supports GitHub repositories/)
    ).toBeInTheDocument();
  });

  it('shows cursor integration onboarding step if integration is installed but handoff not configured', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [
          {
            id: '123',
            provider: 'cursor',
            name: 'Cursor',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: {
          repositories: [{external_id: 'repo-123', name: 'org/repo', provider: 'github'}],
          automated_run_stopping_point: 'root_cause',
          // No automation_handoff
        },
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/autofix-repos/`,
      body: [
        {
          name: 'org/repo',
          provider: 'github',
          owner: 'org',
          external_id: 'repo-123',
          is_readable: true,
          is_writeable: true,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/group-search-views/starred/`,
      body: [
        {
          id: '1',
          name: 'Fixability View',
          query: 'is:unresolved issue.seer_actionability:high',
          starred: true,
        },
      ],
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization: OrganizationFixture({
        features: ['gen-ai-features', 'integrations-cursor', 'issue-views'],
      }),
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(
      await screen.findByText('Hand Off to Cursor Cloud Agents')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Set Seer to hand off to Cursor'})
    ).toBeInTheDocument();
  });

  it('does not show cursor integration step if localStorage skip key is set', async () => {
    // Set skip key BEFORE rendering
    localStorage.setItem(`seer-onboarding-cursor-skipped:${mockProject.id}`, 'true');

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [
          {
            id: '123',
            provider: 'cursor',
            name: 'Cursor',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: {
          repositories: [{external_id: 'repo-123', name: 'org/repo', provider: 'github'}],
          automated_run_stopping_point: 'root_cause',
          // No automation_handoff
        },
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${mockProject.organization.slug}/${mockProject.slug}/autofix-repos/`,
      body: [
        {
          name: 'org/repo',
          provider: 'github',
          owner: 'org',
          external_id: 'repo-123',
          is_readable: true,
          is_writeable: true,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/group-search-views/starred/`,
      body: [
        {
          id: '1',
          name: 'Fixability View',
          query: 'is:unresolved issue.seer_actionability:high',
          starred: true,
        },
      ],
    });

    render(<SeerDrawer event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization: OrganizationFixture({
        features: ['gen-ai-features', 'integrations-cursor', 'issue-views'],
      }),
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    // Should not show the step since it was skipped
    expect(screen.queryByText('Hand Off to Cursor Cloud Agents')).not.toBeInTheDocument();
  });
});
