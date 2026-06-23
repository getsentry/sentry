import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {SeerDrawer} from 'sentry/views/issueDetails/sidebar/seerDrawer';

function makeExplorerBlock({
  id = 'block-1',
  content = 'Analysis content',
  step,
  loading = false,
  artifacts,
}: {
  artifacts?: Array<{data: Record<string, unknown>; key: string; reason: string}>;
  content?: string;
  id?: string;
  loading?: boolean;
  step?: string;
} = {}) {
  return {
    id,
    message: {
      role: 'assistant' as const,
      content,
      metadata: step ? {step} : null,
    },
    timestamp: '2024-01-01T00:00:00Z',
    loading,
    artifacts: artifacts ?? [],
  };
}

function makeExplorerAutofixData({
  blocks = [makeExplorerBlock()],
  status = 'completed' as const,
  run_id = 1,
}: {
  blocks?: Array<ReturnType<typeof makeExplorerBlock>>;
  run_id?: number;
  status?: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
} = {}) {
  return {
    run_id,
    blocks,
    status,
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('SeerDrawer', () => {
  const organization = OrganizationFixture({
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  const mockGroup = GroupFixture();
  const mockProject = DetailedProjectFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
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

  it('renders loading state while autofix setup is pending', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );
  });

  it('renders Seer Autofix header text after loading', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText('Seer Autofix')).toBeInTheDocument();
  });

  it('shows reset button that is always enabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const resetButton = screen.getByRole('button', {
      name: 'Start a new analysis from scratch',
    });
    expect(resetButton).toBeInTheDocument();
    expect(resetButton).toBeEnabled();
  });

  it('shows copy button disabled when no autofix run exists', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const copyButton = screen.getByRole('button', {
      name: 'Copy analysis as Markdown',
    });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toBeDisabled();
  });

  it('shows copy button enabled when autofix run exists', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: makeExplorerAutofixData(),
      },
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const copyButton = screen.getByRole('button', {
      name: 'Copy analysis as Markdown',
    });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toBeEnabled();
  });

  it('renders reset button enabled with autofix data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: makeExplorerAutofixData(),
      },
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const resetButton = screen.getByRole('button', {
      name: 'Start a new analysis from scratch',
    });
    expect(resetButton).toBeInTheDocument();
    expect(resetButton).toBeEnabled();
  });

  it('clicking reset triggers a new root cause analysis', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: makeExplorerAutofixData(),
      },
    });

    const postMock = MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      method: 'POST',
      body: {run_id: 2},
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const resetButton = screen.getByRole('button', {
      name: 'Start a new analysis from scratch',
    });
    await userEvent.click(resetButton);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({step: 'root_cause'}),
        })
      );
    });
  });

  it('renders root cause section when blocks contain root cause step', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: makeExplorerAutofixData({
          blocks: [
            makeExplorerBlock({
              id: 'rc-1',
              step: 'root_cause',
              content: 'Root cause analysis result',
              artifacts: [
                {
                  key: 'root_cause',
                  reason: 'Analysis complete',
                  data: {
                    one_line_description: 'A null pointer dereference in the auth module',
                    five_whys: ['First why', 'Second why'],
                  },
                },
              ],
            }),
          ],
          status: 'completed',
        }),
      },
    });

    render(<SeerDrawer group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(
      await screen.findByText('A null pointer dereference in the auth module')
    ).toBeInTheDocument();
  });
});
