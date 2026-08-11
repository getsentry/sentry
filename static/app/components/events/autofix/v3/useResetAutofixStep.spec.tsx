import {
  act,
  renderHookWithProviders,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  RetryStepProvider,
  useRetryStep,
} from 'sentry/components/events/autofix/v3/retryStepContext';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  const base: ReturnType<typeof useExplorerAutofix> = {
    runState: null,
    startStep: jest.fn(),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    warnings: [],
    isLoading: false,
    isPolling: false,
  };
  return {...base, ...overrides};
}

function makeSection(overrides: Partial<AutofixSection> = {}): AutofixSection {
  return {
    artifacts: [],
    blocks: [],
    status: 'completed',
    step: 'root_cause',
    index: 0,
    ...overrides,
  };
}

describe('useResetAutofixStep', () => {
  describe('canReset', () => {
    it('returns true when all conditions are met', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
          repo_pr_states: {},
          coding_agents: {},
        },
      });

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.canReset).toBe(true);
    });

    it('returns false when status is processing', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'processing',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.canReset).toBe(false);
    });

    it('returns false when PRs have been created', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
          repo_pr_states: {
            'repo-1': {
              repo_name: 'repo-1',
              branch_name: 'fix/branch',
              commit_sha: 'abc123',
              pr_creation_error: null,
              pr_creation_status: 'completed',
              pr_id: 1,
              pr_number: 42,
              pr_url: 'https://github.com/org/repo/pull/42',
              title: 'Fix bug',
            },
          },
          coding_agents: {},
        },
      });

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.canReset).toBe(false);
    });

    it('uses the canReset override when provided', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
          repo_pr_states: {
            'repo-1': {
              repo_name: 'repo-1',
              branch_name: 'fix/branch',
              commit_sha: 'abc123',
              pr_creation_error: null,
              pr_creation_status: 'completed',
              pr_id: 1,
              pr_number: 42,
              pr_url: 'https://github.com/org/repo/pull/42',
              title: 'Fix bug',
            },
          },
          coding_agents: {},
        },
      });

      const withoutOverride = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'code_changes'})
      );
      expect(withoutOverride.result.current.canReset).toBe(false);

      const withOverride = renderHookWithProviders(() =>
        useResetAutofixStep({
          autofix,
          canReset: true,
          section: makeSection(),
          step: 'code_changes',
        })
      );
      expect(withOverride.result.current.canReset).toBe(true);
    });

    it('returns false when coding agents have been started', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
          repo_pr_states: {},
          coding_agents: {
            'agent-1': {
              id: 'agent-1',
              name: 'Coding Agent',
              provider: 'github',
              started_at: '2024-01-01T00:00:00Z',
              status: 'running',
            },
          },
        },
      });

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.canReset).toBe(false);
    });

    it('returns false when reset prompt is showing', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
          repo_pr_states: {},
          coding_agents: {},
        },
      });

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.canReset).toBe(true);

      act(() => {
        result.current.setShouldShowReset(true);
      });

      expect(result.current.canReset).toBe(false);
    });
  });

  describe('handleReset', () => {
    it('calls startStep with correct arguments', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 42,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
        },
      });
      const section = makeSection({index: 3});

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section, step: 'solution'})
      );

      act(() => void result.current.handleReset());

      expect(autofix.startStep).toHaveBeenCalledWith('solution', {
        runId: 42,
        userContext: undefined,
        insertIndex: 3,
      });
    });

    it('passes userContext when provided', () => {
      const autofix = makeAutofix({
        runState: {
          run_id: 7,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({
          autofix,
          section: makeSection({index: 1}),
          step: 'code_changes',
        })
      );

      act(() => void result.current.handleReset('Please focus on the auth module'));

      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', {
        runId: 7,
        userContext: 'Please focus on the auth module',
        insertIndex: 1,
      });
    });
  });

  describe('external retry requests', () => {
    const scrollIntoView = jest.fn();

    beforeEach(() => {
      scrollIntoView.mockClear();
      // jsdom has no layout, so scrollIntoView is not implemented on elements.
      Element.prototype.scrollIntoView = scrollIntoView;
    });

    function renderWithBanner(step: 'root_cause' | 'code_changes') {
      const autofix = makeAutofix({
        runState: {
          run_id: 1,
          status: 'completed',
          blocks: [],
          updated_at: '2024-01-01T00:00:00Z',
          repo_pr_states: {},
          coding_agents: {},
        },
      });

      // A banner outside the card asks for the code changes step to be retried.
      function Banner() {
        const retryStep = useRetryStep();
        return (
          <button onClick={() => retryStep?.requestRetry('code_changes')}>request</button>
        );
      }

      const rendered = renderHookWithProviders(
        () => useResetAutofixStep({autofix, section: makeSection(), step}),
        {
          additionalWrapper: ({children}) => (
            <RetryStepProvider>
              <Banner />
              {children}
            </RetryStepProvider>
          ),
        }
      );

      return {...rendered, autofix};
    }

    it('opens and scrolls to the prompt when its own step is requested', async () => {
      const {result, autofix} = renderWithBanner('code_changes');

      // The hook's ref is only attached once a card renders it.
      result.current.cardRef.current = document.createElement('div');

      await userEvent.click(screen.getByRole('button', {name: 'request'}));

      expect(result.current.shouldShowReset).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
      // Requesting a retry must not start the step on the user's behalf.
      expect(autofix.startStep).not.toHaveBeenCalled();
    });

    it('ignores a request aimed at another step', async () => {
      const {result} = renderWithBanner('root_cause');

      await userEvent.click(screen.getByRole('button', {name: 'request'}));

      expect(result.current.shouldShowReset).toBe(false);
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('stays resettable when a push failed instead of opening a PR', () => {
    const autofix = makeAutofix({
      runState: {
        run_id: 1,
        status: 'completed',
        blocks: [],
        updated_at: '2024-01-01T00:00:00Z',
        repo_pr_states: {
          'repo-1': {
            repo_name: 'repo-1',
            branch_name: 'fix/branch',
            commit_sha: 'abc123',
            pr_creation_error: 'Resource not accessible by integration',
            pr_creation_status: 'error',
            pr_id: null,
            pr_number: null,
            pr_url: null,
            title: 'Fix bug',
          },
        },
        coding_agents: {},
      },
    });

    const {result} = renderHookWithProviders(() =>
      useResetAutofixStep({autofix, section: makeSection(), step: 'code_changes'})
    );

    expect(result.current.canReset).toBe(true);
  });

  describe('state management', () => {
    it('defaults shouldShowReset to false and allows toggling', () => {
      const autofix = makeAutofix();

      const {result} = renderHookWithProviders(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.shouldShowReset).toBe(false);

      act(() => {
        result.current.setShouldShowReset(true);
      });

      expect(result.current.shouldShowReset).toBe(true);

      act(() => {
        result.current.setShouldShowReset(false);
      });

      expect(result.current.shouldShowReset).toBe(false);
    });
  });
});
