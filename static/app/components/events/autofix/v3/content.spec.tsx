import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  ExplorerAutofixState,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ConfigStore} from 'sentry/stores/configStore';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';

import {SeerDrawerContent} from './content';

jest.mock('sentry/views/seerExplorer/components/drawer/explorerDrawerContent', () => ({
  ExplorerDrawerContent: () => null,
}));

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState: null,
    autofixFormatted: null,
    startStep: jest.fn(),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    warnings: [],
    isLoading: false,
    isWaitingForRun: false,
    isPolling: false,
    isProcessing: false,
    ...overrides,
  };
}

function makeAiConfig(
  overrides: Partial<ReturnType<typeof useAiConfig>> = {}
): ReturnType<typeof useAiConfig> {
  return {
    areAiFeaturesAllowed: true,
    hasAutofix: true,
    hasAutofixQuota: true,
    hasGithubIntegration: true,
    hasResources: false,
    hasSummary: true,
    isAutofixSetupLoading: false,
    orgNeedsGenAiAcknowledgement: false,
    refetchAutofixSetup: jest.fn(),
    seerReposLinked: true,
    ...overrides,
  };
}

describe('SeerDrawerContent', () => {
  it('allows starting Autofix when no run exists', async () => {
    const startStep = jest.fn().mockResolvedValue(undefined);

    render(
      <SeerDrawerContent
        aiConfig={makeAiConfig()}
        autofix={makeAutofix({startStep})}
        group={GroupFixture()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Start Analysis'}));

    expect(startStep).toHaveBeenCalledWith('root_cause', {
      enableBashMode: undefined,
    });
  });

  it('starts Autofix with bash tools when force bash mode is set', async () => {
    localStorage.setItem('autofix-force-bash-mode', 'true');
    const startStep = jest.fn().mockResolvedValue(undefined);

    render(
      <SeerDrawerContent
        aiConfig={makeAiConfig()}
        autofix={makeAutofix({startStep})}
        group={GroupFixture()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Start Analysis'}));

    expect(startStep).toHaveBeenCalledWith('root_cause', {enableBashMode: true});
  });

  describe('single run', () => {
    const runState: ExplorerAutofixState = {
      run_id: 7,
      feature_id: 'autofix_single_run',
      status: 'completed',
      updated_at: '2026-10-27T00:00:00Z',
      blocks: [
        {
          id: 'block-0',
          timestamp: '2026-10-27T00:00:00Z',
          message: {role: 'user', content: 'Fix issue SENTRY-1 end to end.'},
        },
        {
          id: 'block-1',
          timestamp: '2026-10-27T00:00:00Z',
          message: {
            role: 'assistant',
            content: 'The divisor is never checked for zero.',
          },
        },
      ],
      repo_pr_states: {
        'owner/repo': {
          repo_name: 'owner/repo',
          branch_name: 'seer/fix-divide-by-zero',
          commit_sha: 'abc123',
          pr_creation_error: null,
          pr_creation_status: 'completed',
          pr_id: 1,
          pr_number: 42,
          pr_url: 'https://github.com/owner/repo/pull/42',
          title: 'Guard against a zero divisor',
        },
      },
    };

    const explorerOrganization = OrganizationFixture({
      features: ['seer-explorer', 'gen-ai-features'],
      openMembership: true,
    });

    function mockExplorerChat(ownerUserId: number | null) {
      MockApiClient.addMockResponse({
        url: `/organizations/${explorerOrganization.slug}/seer/explorer-chat/7/`,
        body: {
          session: {
            run_id: 7,
            status: 'completed',
            updated_at: runState.updated_at,
            blocks: runState.blocks,
            owner_user_id: ownerUserId,
          },
        },
      });
    }

    function renderExplorerDrawer() {
      return render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState})}
          group={GroupFixture()}
        />,
        {organization: explorerOrganization}
      );
    }

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      ConfigStore.set('user', UserFixture({id: '1'}));
    });

    it('renders the run as a chat with its pull request', async () => {
      mockExplorerChat(1);
      renderExplorerDrawer();

      expect(
        await screen.findByText('The divisor is never checked for zero.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Fix issue SENTRY-1 end to end.')
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'View owner/repo#42'})).toHaveAttribute(
        'href',
        'https://github.com/owner/repo/pull/42'
      );
      expect(
        screen.getByRole('button', {name: 'Open in Seer Explorer'})
      ).toBeInTheDocument();
    });

    it('lets the run owner reply', async () => {
      mockExplorerChat(1);
      const reply = MockApiClient.addMockResponse({
        url: `/organizations/${explorerOrganization.slug}/seer/explorer-chat/7/`,
        method: 'POST',
        body: {run_id: 7},
      });
      renderExplorerDrawer();

      const composer = await screen.findByRole('combobox', {name: 'Ask Seer a question'});
      composer.setAttribute('contenteditable', 'true');
      await userEvent.type(composer, 'why?');
      await userEvent.keyboard('{Enter}');

      expect(reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({query: 'why?', insert_index: 2}),
        })
      );
    });

    it('opens this run in Seer Explorer', async () => {
      mockExplorerChat(1);
      render(
        <SeerExplorerChatStateProvider>
          <SeerDrawerContent
            aiConfig={makeAiConfig()}
            autofix={makeAutofix({runState})}
            group={GroupFixture()}
          />
        </SeerExplorerChatStateProvider>,
        {organization: explorerOrganization}
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Open in Seer Explorer'})
      );

      expect(sessionStorage.getItem('seer-explorer-run-id')).toBe('7');
    });

    it('follows a new run in the same drawer', async () => {
      mockExplorerChat(1);
      MockApiClient.addMockResponse({
        url: `/organizations/${explorerOrganization.slug}/seer/explorer-chat/8/`,
        body: {
          session: {
            run_id: 8,
            status: 'completed',
            updated_at: runState.updated_at,
            blocks: [
              runState.blocks[0],
              {...runState.blocks[1], message: {role: 'assistant', content: 'Run 8.'}},
            ],
            owner_user_id: 1,
          },
        },
      });
      const {rerender} = renderExplorerDrawer();
      expect(
        await screen.findByText('The divisor is never checked for zero.')
      ).toBeInTheDocument();

      rerender(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: {...runState, run_id: 8}})}
          group={GroupFixture()}
        />
      );

      expect(await screen.findByText('Run 8.')).toBeInTheDocument();
    });

    it.each([
      ['someone else', 999],
      ['an automated run', null],
    ])('is read-only for %s', async (_, ownerUserId) => {
      mockExplorerChat(ownerUserId);
      renderExplorerDrawer();

      expect(
        await screen.findByPlaceholderText(
          'Only the person who started this run can reply.'
        )
      ).toBeDisabled();
      expect(
        screen.queryByRole('combobox', {name: 'Ask Seer a question'})
      ).not.toBeInTheDocument();
    });

    it('hides the Seer Explorer link without Seer Explorer', () => {
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState})}
          group={GroupFixture()}
        />
      );

      expect(
        screen.getByText('The divisor is never checked for zero.')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Open in Seer Explorer'})
      ).not.toBeInTheDocument();
    });

    it('shows a placeholder while the run has only its kickoff prompt', () => {
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({
            runState: {
              ...runState,
              status: 'processing',
              blocks: runState.blocks.slice(0, 1),
              repo_pr_states: {},
            },
          })}
          group={GroupFixture()}
        />
      );

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
      expect(
        screen.queryByText('Fix issue SENTRY-1 end to end.')
      ).not.toBeInTheDocument();
    });

    it('says when the run errored', () => {
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: {...runState, status: 'error'}})}
          group={GroupFixture()}
        />
      );

      expect(
        screen.getByText('Autofix ran into an error and stopped.')
      ).toBeInTheDocument();
    });
  });
});
