import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import type {
  AutofixArtifact,
  AutofixSection,
  RootCauseArtifact,
  SolutionArtifact,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {CodeChangesCard} from 'sentry/components/events/autofix/v3/codeChangesCard';
import {CodingAgentsCard} from 'sentry/components/events/autofix/v3/codingAgentsCard';
import {PullRequestsCard} from 'sentry/components/events/autofix/v3/pullRequestsCard';
import {RootCauseCard} from 'sentry/components/events/autofix/v3/rootCauseCard';
import {SolutionCard} from 'sentry/components/events/autofix/v3/solutionCard';
import type {
  ExplorerCodingAgentState,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

jest.mock('sentry/views/seerExplorer/components/fileDiffViewer', () => ({
  FileDiffViewer: () => <div data-testid="file-diff-viewer" />,
}));

const prIterationOrganization = OrganizationFixture({features: ['autofix-pr-iteration']});

function makeSection(
  step: string,
  status: AutofixSection['status'],
  artifacts: AutofixArtifact[],
  blocks: AutofixSection['blocks'] = []
): AutofixSection {
  return {step, artifacts, blocks, status};
}

function makeAssistantBlock(content: string | null): AutofixSection['blocks'][number] {
  return {
    id: 'block-1',
    timestamp: '2026-01-01T00:00:00Z',
    message: {role: 'assistant', content},
  };
}

function makePrIterationBlock(
  iterationIndex: number,
  feedback: {text: string; timestamp?: string; user?: any}
): AutofixSection['blocks'][number] {
  return {
    id: `block-pr-${iterationIndex}`,
    timestamp: '2026-01-01T00:00:00Z',
    message: {
      role: 'user',
      content: null,
      metadata: {
        step: 'pr_iteration',
        iteration_index: String(iterationIndex),
        feedback: JSON.stringify({
          text: feedback.text,
          timestamp: feedback.timestamp,
          source: feedback.user
            ? {type: 'user-ui', user: feedback.user}
            : {type: 'user-ui'},
        }),
      },
    },
  };
}

function makePatch(repoName: string, path: string): ExplorerFilePatch {
  return {
    repo_name: repoName,
    diff: '',
    patch: {
      path,
      added: 1,
      removed: 0,
      hunks: [],
      source_file: path,
      target_file: path,
      type: 'M',
    },
  } as ExplorerFilePatch;
}

function makePR(overrides: Partial<RepoPRState> = {}): RepoPRState {
  return {
    repo_name: 'org/repo',
    pr_number: 42,
    pr_url: 'https://github.com/org/repo/pull/42',
    branch_name: 'fix/issue',
    commit_sha: 'abc123',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 1,
    title: 'Fix issue',
    ...overrides,
  };
}

const mockAutofix: ReturnType<typeof useExplorerAutofix> = {
  runState: null,
  isLoading: false,
  isPolling: false,
  startStep: jest.fn(),
  createPR: jest.fn(),
  reset: jest.fn(),
  triggerCodingAgentHandoff: jest.fn(),
  codingAgentErrors: [],
  dismissCodingAgentError: jest.fn(),
  warnings: [],
};

const mockAutofixWithRunState: ReturnType<typeof useExplorerAutofix> = {
  ...mockAutofix,
  runState: {
    run_id: 123,
    blocks: [],
    status: 'completed' as const,
    updated_at: '2026-01-01T00:00:00Z',
  },
};

function makeRootCauseArtifact(data: RootCauseArtifact | null) {
  return {
    key: 'root-cause',
    reason: 'Found root cause',
    data,
  };
}

function makeSolutionArtifact(data: SolutionArtifact | null) {
  return {
    key: 'solution',
    reason: 'Found solution',
    data,
  };
}

describe('ArtifactCard', () => {
  beforeEach(() => {
    userEvent.setup();
    jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RootCauseCard', () => {
    it('renders title and one_line_description summary', () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Null pointer in user handler',
        five_whys: ['why1', 'why2'],
        reproduction_steps: ['step1'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Root Cause')).toBeInTheDocument();
      expect(screen.getByText('Null pointer in user handler')).toBeInTheDocument();
    });

    it('renders five_whys list items and heading', () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Bug',
        five_whys: ['First why', 'Second why', 'Third why'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Why did this happen?')).toBeInTheDocument();
      expect(screen.getByText('First why')).toBeInTheDocument();
      expect(screen.getByText('Second why')).toBeInTheDocument();
      expect(screen.getByText('Third why')).toBeInTheDocument();
    });

    it('renders reproduction_steps when present', () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Bug',
        five_whys: ['why1'],
        reproduction_steps: ['Open the page', 'Click button'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Reproduction Steps')).toBeInTheDocument();
      expect(screen.getByText('Open the page')).toBeInTheDocument();
      expect(screen.getByText('Click button')).toBeInTheDocument();
    });

    it('renders card shell when artifact data is null', () => {
      const artifact = makeRootCauseArtifact(null);

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Root Cause')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Seer failed to generate a root cause. This one is on us. Try running it again.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
    });

    it('handles empty five_whys with placeholder', () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Bug',
        five_whys: [],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Root Cause')).toBeInTheDocument();
      expect(screen.queryByText('Why did this happen?')).not.toBeInTheDocument();
    });

    it('copies markdown when copy button is clicked', async () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Null pointer in user handler',
        five_whys: ['Missing null check'],
        reproduction_steps: ['Open page'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Null pointer in user handler')
      );
    });

    it('does not show copy button when artifact data is null', () => {
      const artifact = makeRootCauseArtifact(null);

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.queryByRole('button', {name: 'Copy as Markdown'})).toBeDisabled();
    });
  });

  describe('SolutionCard', () => {
    it('renders title and one_line_summary', () => {
      const artifact = makeSolutionArtifact({
        one_line_summary: 'Add null check before accessing user',
        steps: [{title: 'Step 1', description: 'Add guard'}],
      });

      render(
        <SolutionCard
          autofix={mockAutofix}
          section={makeSection('solution', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(
        screen.getByText('Add null check before accessing user')
      ).toBeInTheDocument();
    });

    it('renders steps with title and description', () => {
      const artifact = makeSolutionArtifact({
        one_line_summary: 'Fix the bug',
        steps: [
          {title: 'Add validation', description: 'Check input is not null'},
          {title: 'Update handler', description: 'Handle edge case'},
        ],
      });

      render(
        <SolutionCard
          autofix={mockAutofix}
          section={makeSection('solution', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Steps to Resolve')).toBeInTheDocument();
      expect(screen.getByText('Add validation')).toBeInTheDocument();
      expect(screen.getByText('Check input is not null')).toBeInTheDocument();
      expect(screen.getByText('Update handler')).toBeInTheDocument();
      expect(screen.getByText('Handle edge case')).toBeInTheDocument();
    });

    it('renders card shell when artifact data is null', () => {
      const artifact = makeSolutionArtifact(null);

      render(
        <SolutionCard
          autofix={mockAutofix}
          section={makeSection('solution', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Seer failed to generate a plan. This one is on us. Try running it again.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
    });

    it('copies markdown when copy button is clicked', async () => {
      const artifact = makeSolutionArtifact({
        one_line_summary: 'Add null check before accessing user',
        steps: [{title: 'Add guard', description: 'Check input'}],
      });

      render(
        <SolutionCard
          autofix={mockAutofix}
          section={makeSection('solution', 'completed', [artifact])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Add null check before accessing user')
      );
    });

    it('does not show copy button when artifact data is null', () => {
      const artifact = makeSolutionArtifact(null);

      render(
        <SolutionCard
          autofix={mockAutofix}
          section={makeSection('solution', 'completed', [artifact])}
        />
      );

      expect(screen.queryByRole('button', {name: 'Copy as Markdown'})).toBeDisabled();
    });
  });

  describe('CodeChangesCard', () => {
    it('renders single file in single repo', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />
      );

      expect(screen.getByText('Code Changes')).toBeInTheDocument();
      expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
    });

    it('renders multiple files in single repo', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [
            [
              makePatch('org/repo', 'src/app.py'),
              makePatch('org/repo', 'src/utils.py'),
              makePatch('org/repo', 'src/models.py'),
            ],
          ])}
        />
      );

      expect(screen.getByText('3 files changed in 1 repo')).toBeInTheDocument();
    });

    it('renders multiple files in multiple repos', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [
            [
              makePatch('org/repo-a', 'src/app.py'),
              makePatch('org/repo-a', 'src/utils.py'),
              makePatch('org/repo-b', 'src/index.ts'),
            ],
          ])}
        />
      );

      expect(screen.getByText('3 files changed in 2 repos')).toBeInTheDocument();
    });

    it('renders repository name labels', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [
            [
              makePatch('org/repo-a', 'src/app.py'),
              makePatch('org/repo-b', 'src/index.ts'),
            ],
          ])}
        />
      );

      expect(screen.getByText('org/repo-a')).toBeInTheDocument();
      expect(screen.getByText('org/repo-b')).toBeInTheDocument();
    });

    it('renders card shell when no code changes artifact found', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [])}
        />
      );

      expect(screen.getByText('Code Changes')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Seer failed to generate a code change. This one is on us. Try running it again.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
    });

    it('copies markdown when copy button is clicked', async () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Code Changes')
      );
    });

    it('does not show copy button when no patches', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [])}
        />
      );

      expect(screen.queryByRole('button', {name: 'Copy as Markdown'})).toBeDisabled();
    });

    it('renders error state when all patches have no changes', () => {
      const emptyPatch = {
        repo_name: 'org/repo',
        diff: '',
        patch: {
          path: 'src/app.py',
          added: 0,
          removed: 0,
          hunks: [],
          source_file: 'src/app.py',
          target_file: 'src/app.py',
          type: 'M',
        },
      } as ExplorerFilePatch;

      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [[emptyPatch]])}
        />
      );

      expect(
        screen.getByText(
          'Seer failed to generate a code change. This one is on us. Try running it again.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
    });

    it('calls startStep when re-run button is clicked in error state', async () => {
      const startStepMock = jest.fn();
      const autofixWithRunState = {
        ...mockAutofix,
        startStep: startStepMock,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed' as const,
          updated_at: '2026-01-01T00:00:00Z',
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithRunState}
          section={makeSection('code_changes', 'completed', [])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Re-run'}));
      expect(startStepMock).toHaveBeenCalledWith(
        'code_changes',
        expect.objectContaining({runId: 123})
      );
    });

    it('renders loading state when processing, not error', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'processing', [])}
        />
      );

      expect(screen.getByText('Implementing changes…')).toBeInTheDocument();
      expect(
        screen.queryByText(
          'Seer failed to generate a code change. This one is on us. Try running it again.'
        )
      ).not.toBeInTheDocument();
    });

    it('does not render file diff viewers in error state', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [])}
        />
      );

      expect(screen.queryByTestId('file-diff-viewer')).not.toBeInTheDocument();
    });

    it('surfaces the agent explanation when no patches but a final message exists', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofixWithRunState}
          section={makeSection(
            'code_changes',
            'completed',
            [],
            [
              makeAssistantBlock(
                'This fix requires a database migration, not a code change.'
              ),
            ]
          )}
        />
      );

      expect(
        screen.getByText("Seer proposed a fix but couldn't apply it automatically")
      ).toBeInTheDocument();
      expect(
        screen.getByText('This fix requires a database migration, not a code change.')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Add context & retry'})
      ).toBeInTheDocument();
      // The generic "this one is on us" copy should not appear here.
      expect(
        screen.queryByText(
          'Seer failed to generate a code change. This one is on us. Try running it again.'
        )
      ).not.toBeInTheDocument();
    });

    it('opens the context prompt from the explanation state', async () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofixWithRunState}
          section={makeSection(
            'code_changes',
            'completed',
            [],
            [makeAssistantBlock('The relevant files are not in the connected repo.')]
          )}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add context & retry'}));

      expect(
        screen.getByText('What additional context should Seer use?')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Add context & retry'})
      ).not.toBeInTheDocument();
    });

    it('opens PR iteration feedback from explanation state when a PR exists', async () => {
      const startStepMock = jest.fn();
      const autofixWithPR: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofixWithRunState,
        startStep: startStepMock,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          repo_pr_states: {'org/repo': makePR()},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithPR}
          section={makeSection(
            'code_changes',
            'completed',
            [],
            [makeAssistantBlock('The relevant files are not in the connected repo.')]
          )}
        />,
        {organization: prIterationOrganization}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add context & retry'}));

      expect(
        screen.getByText('Anything else you want to see on your PR?')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('What additional context should Seer use?')
      ).not.toBeInTheDocument();

      await userEvent.type(screen.getByRole('textbox'), 'Try the other repo');
      await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

      expect(startStepMock).toHaveBeenCalledWith('pr_iteration', {
        runId: 123,
        userContext: 'Try the other repo',
      });
    });

    it('falls back to the generic failure copy when there is no explanation', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'completed',
            [],
            [makeAssistantBlock('   ')]
          )}
        />
      );

      expect(
        screen.getByText(
          'Seer failed to generate a code change. This one is on us. Try running it again.'
        )
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Seer proposed a fix but couldn't apply it automatically")
      ).not.toBeInTheDocument();
    });

    it('silently ignores pr_iteration blocks with an unrecognized source type', () => {
      const block: AutofixSection['blocks'][number] = {
        id: 'block-unknown',
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: null,
          metadata: {
            step: 'pr_iteration',
            iteration_index: '0',
            feedback: JSON.stringify({text: 'ignored', source: {type: 'mystery'}}),
          },
        },
      };
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [block]
          )}
        />
      );

      expect(screen.queryByText('Feedback')).not.toBeInTheDocument();
    });

    it('renders feedback from pr_iteration blocks', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [makePrIterationBlock(1, {text: 'Add a test for this'})]
          )}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('Feedback')).toBeInTheDocument();
      expect(screen.getByText('Add a test for this')).toBeInTheDocument();
    });

    it('renders the latest feedback at the top of the list', () => {
      const autofixWithQueued: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          queued_feedback: [{text: 'newest queued', source: {type: 'user-ui'}}],
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithQueued}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [
              makePrIterationBlock(0, {text: 'first pass'}),
              makePrIterationBlock(1, {text: 'second pass'}),
            ]
          )}
        />,
        {organization: prIterationOrganization}
      );

      const items = screen.getAllByText(/first pass|second pass|newest queued/);
      expect(items.map(item => item.textContent)).toEqual([
        'newest queued',
        'second pass',
        'first pass',
      ]);
    });

    it('shows the code changes, not the loader, when feedback is only queued', () => {
      const autofixWithQueued: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          queued_feedback: [{text: 'Make the button blue', source: {type: 'user-ui'}}],
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithQueued}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [makePrIterationBlock(0, {text: 'first pass'})]
          )}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
      expect(screen.queryByText('Iterating on PR…')).not.toBeInTheDocument();
      expect(screen.queryByText('Implementing changes…')).not.toBeInTheDocument();
    });

    it('renders queued feedback as a feedback item', () => {
      const autofixWithQueued: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          queued_feedback: [{text: 'Make the button blue', source: {type: 'user-ui'}}],
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithQueued}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('Feedback')).toBeInTheDocument();
      expect(screen.getByText('Make the button blue')).toBeInTheDocument();
    });

    it('renders queued feedback with missing source attribution', () => {
      const autofixWithQueued: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          queued_feedback: [{text: 'Make the button blue'}],
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithQueued}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('(unknown): Make the button blue')).toBeInTheDocument();
    });

    it('shows the code changes for queued feedback without the feature flag', () => {
      const autofixWithQueued: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          queued_feedback: [{text: 'Make the button blue', source: {type: 'user-ui'}}],
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithQueued}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />
      );

      expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
      expect(screen.queryByText('Implementing changes…')).not.toBeInTheDocument();
      expect(screen.queryByText('Iterating on PR…')).not.toBeInTheDocument();
    });

    it('does not render iteration feedback without the feature flag', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [makePrIterationBlock(1, {text: 'Add a test for this'})]
          )}
        />
      );

      expect(screen.queryByText('Feedback')).not.toBeInTheDocument();
      expect(screen.queryByText('Add a test for this')).not.toBeInTheDocument();
      expect(screen.queryByText(/- Latest/)).not.toBeInTheDocument();
    });

    it('renders a one-based version tag for the latest iteration', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [
              makePrIterationBlock(0, {text: 'first pass'}),
              makePrIterationBlock(1, {text: 'second pass'}),
            ]
          )}
        />,
        {organization: prIterationOrganization}
      );

      // iteration_index is zero-based; the latest (1) renders as v2.
      expect(screen.getByText('v2 - Latest')).toBeInTheDocument();
    });

    it('does not render a version tag without iterations', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />
      );

      expect(screen.queryByText(/- Latest/)).not.toBeInTheDocument();
    });

    it('shows the iterating loading message when processing a pr_iteration', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'processing',
            [],
            [makePrIterationBlock(0, {text: 'fix the CI failure'})]
          )}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('Iterating on PR…')).toBeInTheDocument();
      expect(screen.queryByText('Implementing changes…')).not.toBeInTheDocument();
    });

    it('marks block feedback as processed when the section is not processing', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'completed',
            [[makePatch('org/repo', 'src/app.py')]],
            [makePrIterationBlock(0, {text: 'first pass'})]
          )}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('first pass')).toBeInTheDocument();
      expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    });

    it('marks the current iteration feedback as in progress while processing', () => {
      render(
        <CodeChangesCard
          groupId="1"
          autofix={mockAutofix}
          section={makeSection(
            'code_changes',
            'processing',
            [],
            [makePrIterationBlock(0, {text: 'fix the CI failure'})]
          )}
        />,
        {organization: prIterationOrganization}
      );

      const row =
        screen.getByText('fix the CI failure').parentElement!.parentElement!
          .parentElement!;
      expect(within(row).getByTestId('loading-indicator')).toBeInTheDocument();
      expect(within(row).queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    });

    it('marks queued feedback with a queued label and no timestamp', () => {
      const autofixWithQueued: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          queued_feedback: [{text: 'Make the button blue', source: {type: 'user-ui'}}],
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofixWithQueued}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByText('Make the button blue')).toBeInTheDocument();
      expect(screen.getByText('Queued')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    });

    it('keeps reset enabled with the feature flag even when PRs exist', () => {
      const autofix: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          repo_pr_states: {'org/repo': makePR()},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByRole('button', {name: 'Re-run step'})).toBeEnabled();
    });

    it('disables reset with the feature flag while processing before any PR exists', () => {
      const autofix: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'processing',
          updated_at: '2026-01-01T00:00:00Z',
          repo_pr_states: {},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByRole('button', {name: 'Re-run step'})).toBeDisabled();
    });

    it('keeps reset enabled with the feature flag while processing once a PR exists', () => {
      const autofix: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'processing',
          updated_at: '2026-01-01T00:00:00Z',
          repo_pr_states: {'org/repo': makePR()},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByRole('button', {name: 'Re-run step'})).toBeEnabled();
    });

    it('disables reset without the feature flag when PRs exist', () => {
      const autofix: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          repo_pr_states: {'org/repo': makePR()},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />
      );

      expect(screen.getByRole('button', {name: 'Re-run step'})).toBeDisabled();
    });

    it('disables reset while a coding agent is active', () => {
      const autofix: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          coding_agents: {a: {} as any},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofix}
          section={makeSection('code_changes', 'completed', [
            [makePatch('org/repo', 'src/app.py')],
          ])}
        />,
        {organization: prIterationOrganization}
      );

      expect(screen.getByRole('button', {name: 'Re-run step'})).toBeDisabled();
    });

    it('shows the PR iteration form mid-run when reset is requested', async () => {
      const autofix: ReturnType<typeof useExplorerAutofix> = {
        ...mockAutofix,
        runState: {
          run_id: 123,
          blocks: [],
          status: 'processing',
          updated_at: '2026-01-01T00:00:00Z',
          repo_pr_states: {'org/repo': makePR()},
        },
      };

      render(
        <CodeChangesCard
          groupId="1"
          autofix={autofix}
          section={makeSection(
            'code_changes',
            'processing',
            [],
            [makePrIterationBlock(0, {text: 'fix the CI failure'})]
          )}
        />,
        {organization: prIterationOrganization}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Re-run step'}));
      expect(
        screen.getByText('Anything else you want to see on your PR?')
      ).toBeInTheDocument();
    });
  });

  describe('PullRequestsCard', () => {
    it('renders PR link buttons with correct text and href', () => {
      render(
        <PullRequestsCard
          autofix={mockAutofixWithRunState}
          section={makeSection('pull_request', 'completed', [[makePR()]])}
        />
      );

      expect(screen.getByText('Pull Requests')).toBeInTheDocument();
      const button = screen.getByRole('button', {
        name: 'View org/repo#42',
      });
      expect(button).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');
    });

    it('renders multiple PR buttons', () => {
      render(
        <PullRequestsCard
          autofix={mockAutofixWithRunState}
          section={makeSection('pull_request', 'completed', [
            [
              makePR({
                repo_name: 'org/repo-a',
                pr_number: 10,
                pr_url: 'https://pr/10',
              }),
              makePR({
                repo_name: 'org/repo-b',
                pr_number: 20,
                pr_url: 'https://pr/20',
              }),
            ],
          ])}
        />
      );

      expect(
        screen.getByRole('button', {name: 'View org/repo-a#10'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'View org/repo-b#20'})
      ).toBeInTheDocument();
    });

    it('skips PRs with missing pr_url or pr_number', () => {
      render(
        <PullRequestsCard
          autofix={mockAutofixWithRunState}
          section={makeSection('pull_request', 'completed', [
            [
              makePR({repo_name: 'org/repo-a', pr_url: null}),
              makePR({repo_name: 'org/repo-b', pr_number: null}),
              makePR({
                repo_name: 'org/valid',
                pr_number: 55,
                pr_url: 'https://pr/55',
              }),
            ],
          ])}
        />
      );

      expect(screen.getByRole('button', {name: /View org\/valid#55/})).toHaveAttribute(
        'href',
        'https://pr/55'
      );
    });

    it('copies markdown when copy button is clicked', async () => {
      render(
        <PullRequestsCard
          autofix={mockAutofixWithRunState}
          section={makeSection('pull_request', 'completed', [[makePR()]])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Pull Requests')
      );
    });
  });

  describe('ArtifactCard expand/collapse', () => {
    it('children are visible by default', () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Bug',
        five_whys: ['Visible why'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Visible why')).toBeInTheDocument();
    });

    it('clicking collapse button hides children', async () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Bug',
        five_whys: ['Hidden why'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Root Cause'}));

      expect(screen.queryByText('Bug')).not.toBeVisible();
      expect(screen.queryByText('Hidden why')).not.toBeVisible();
    });

    it('clicking again re-shows children', async () => {
      const artifact = makeRootCauseArtifact({
        one_line_description: 'Bug',
        five_whys: ['Toggle why'],
      });

      render(
        <RootCauseCard
          autofix={mockAutofix}
          groupId="1"
          section={makeSection('root_cause', 'completed', [artifact])}
        />
      );

      expect(screen.getByText('Bug')).toBeVisible();
      expect(screen.getByText('Toggle why')).toBeVisible();

      await userEvent.click(screen.getByRole('button', {name: 'Root Cause'}));
      expect(screen.queryByText('Bug')).not.toBeVisible();
      expect(screen.queryByText('Toggle why')).not.toBeVisible();

      await userEvent.click(screen.getByRole('button', {name: 'Root Cause'}));
      expect(screen.getByText('Bug')).toBeVisible();
      expect(screen.getByText('Toggle why')).toBeVisible();
    });
  });

  function makeCodingAgent(
    overrides: Partial<ExplorerCodingAgentState> = {}
  ): ExplorerCodingAgentState {
    return {
      id: 'agent-1',
      name: 'My Agent Task',
      provider: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
      started_at: '2026-01-01T00:00:00Z',
      status: 'running',
      ...overrides,
    };
  }

  describe('CodingAgentsCard', () => {
    it('renders agent name based on Cursor provider', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                provider: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
              }),
            ],
          ])}
        />
      );

      expect(screen.getByText('Cursor Cloud Agent')).toBeInTheDocument();
    });

    it('renders agent name based on Claude provider', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                provider: CodingAgentProvider.CLAUDE_CODE_AGENT,
              }),
            ],
          ])}
        />
      );

      expect(screen.getByText('Claude Agent')).toBeInTheDocument();
    });

    it('renders agent name based on GitHub Copilot provider', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                provider: CodingAgentProvider.GITHUB_COPILOT_AGENT,
              }),
            ],
          ])}
        />
      );

      expect(screen.getByText('GitHub Copilot')).toBeInTheDocument();
    });

    it('renders default agent name for unknown provider', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [makeCodingAgent({provider: 'unknown_provider' as any})],
          ])}
        />
      );

      expect(screen.getByText('Coding Agent')).toBeInTheDocument();
    });

    it('renders agent status tags', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [makeCodingAgent({status: 'running'})],
          ])}
        />
      );

      expect(screen.getByText('running')).toBeInTheDocument();
    });

    it('renders "Open in" link when agent_url is present', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                agent_url: 'https://cursor.com/agent/1',
              }),
            ],
          ])}
        />
      );

      const link = screen.getByRole('button', {name: /Open in/});
      expect(link).toHaveAttribute('href', 'https://cursor.com/agent/1');
    });

    it('renders result PR links when results have pr_url', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                results: [
                  {
                    description: 'Fixed',
                    repo_full_name: 'org/repo',
                    repo_provider: 'github',
                    pr_url: 'https://github.com/org/repo/pull/99',
                  },
                ],
              }),
            ],
          ])}
        />
      );

      const link = screen.getByRole('button', {name: 'View Pull Request'});
      expect(link).toHaveAttribute('href', 'https://github.com/org/repo/pull/99');
    });

    it('handles multiple coding agents', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                id: 'agent-1',
                name: 'Agent One',
                status: 'completed',
              }),
              makeCodingAgent({
                id: 'agent-2',
                name: 'Agent Two',
                status: 'running',
              }),
            ],
          ])}
        />
      );

      expect(screen.getByText('Agent One')).toBeInTheDocument();
      expect(screen.getByText('Agent Two')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    it('copies markdown when copy button is clicked', async () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [
            [
              makeCodingAgent({
                agent_url: 'https://cursor.com/agent/1',
              }),
            ],
          ])}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Coding Agents')
      );
    });

    it('does not show copy button when no artifacts', () => {
      render(
        <CodingAgentsCard
          autofix={mockAutofix}
          section={makeSection('coding_agents', 'completed', [])}
        />
      );

      expect(screen.queryByRole('button', {name: 'Copy as Markdown'})).toBeDisabled();
    });
  });
});
