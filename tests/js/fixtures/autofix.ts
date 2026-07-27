import type {
  ExplorerAutofixResponse,
  ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

export function ExplorerAutofixStateFixture(
  params: Partial<ExplorerAutofixState> = {}
): ExplorerAutofixState {
  return {
    blocks: [
      {
        id: 'root-cause',
        artifacts: [
          {
            data: {
              five_whys: ['The faulty code did not handle an unexpected value.'],
              one_line_description: 'The issue was caused by an unexpected value.',
            },
            key: 'root_cause',
            reason: 'Found the root cause',
          },
        ],
        loading: false,
        message: {
          content: 'Root cause complete',
          metadata: {step: 'root_cause'},
          role: 'assistant',
        },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ],
    run_id: 42,
    status: 'completed',
    updated_at: '2024-01-01T00:00:00Z',
    ...params,
  };
}

export function ExplorerAutofixResponseFixture(
  params: Partial<ExplorerAutofixResponse> = {}
): ExplorerAutofixResponse {
  return {
    autofix: ExplorerAutofixStateFixture(),
    ...params,
  };
}

export function AutofixRepoPRStateFixture(
  params: Partial<RepoPRState> = {}
): RepoPRState {
  return {
    branch_name: 'seer/fix',
    commit_sha: 'abc123',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 1,
    pr_number: 10,
    pr_url: 'https://github.com/org/repository/pull/10',
    repo_name: 'org/repository',
    title: 'Fix issue',
    ...params,
  };
}
