import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
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

      const {result} = renderHook(() =>
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

      const {result} = renderHook(() =>
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

      const {result} = renderHook(() =>
        useResetAutofixStep({autofix, section: makeSection(), step: 'root_cause'})
      );

      expect(result.current.canReset).toBe(false);
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

      const {result} = renderHook(() =>
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

      const {result} = renderHook(() =>
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

      const {result} = renderHook(() =>
        useResetAutofixStep({autofix, section, step: 'solution'})
      );

      result.current.handleReset();

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

      const {result} = renderHook(() =>
        useResetAutofixStep({
          autofix,
          section: makeSection({index: 1}),
          step: 'code_changes',
        })
      );

      result.current.handleReset('Please focus on the auth module');

      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', {
        runId: 7,
        userContext: 'Please focus on the auth module',
        insertIndex: 1,
      });
    });
  });

  describe('state management', () => {
    it('defaults shouldShowReset to false and allows toggling', () => {
      const autofix = makeAutofix();

      const {result} = renderHook(() =>
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
