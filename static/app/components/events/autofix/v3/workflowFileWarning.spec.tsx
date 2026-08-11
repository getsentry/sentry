import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  RetryStepProvider,
  useRetryStep,
} from 'sentry/components/events/autofix/v3/retryStepContext';
import {WorkflowFileWarning} from 'sentry/components/events/autofix/v3/workflowFileWarning';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

const makeRepoPRState = (overrides: Partial<RepoPRState> = {}): RepoPRState => ({
  repo_name: 'getsentry/sentry',
  branch_name: 'seer/fix',
  commit_sha: null,
  pr_creation_error: 'resource forbidden',
  pr_creation_status: 'error',
  pr_creation_error_reason: 'workflow_patch',
  pr_id: null,
  pr_number: null,
  pr_url: null,
  title: 'Fix the thing',
  ...overrides,
});

type Block = ExplorerAutofixState['blocks'][number];

const makeBlock = (step: string): Block =>
  ({
    id: 'block-1',
    timestamp: '2026-08-10T00:00:00Z',
    loading: false,
    message: {role: 'assistant', content: '', metadata: {step}},
  }) as unknown as Block;

const makeRunState = (
  repoPRStates: Record<string, RepoPRState>,
  blocks: Block[] = []
): ExplorerAutofixState => ({
  run_id: 7,
  blocks,
  status: 'error',
  updated_at: '2026-08-10T00:00:00Z',
  repo_pr_states: repoPRStates,
});

// Stands in for the code changes card: reports what step the banner asked to
// retry, without pulling the whole card into the test.
function RequestedStep() {
  const retryStep = useRetryStep();
  return <div>requested: {retryStep?.requestedStep ?? 'none'}</div>;
}

describe('WorkflowFileWarning', () => {
  const organization = OrganizationFixture();

  it('renders nothing when no push failed on a workflow file', () => {
    const {container} = render(
      <WorkflowFileWarning
        runState={makeRunState({
          'getsentry/sentry': makeRepoPRState({
            pr_creation_status: 'completed',
            pr_creation_error_reason: null,
          }),
        })}
      />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('explains that Seer cannot write workflow files it edited', () => {
    render(
      <WorkflowFileWarning
        runState={makeRunState({'getsentry/sentry': makeRepoPRState()})}
      />,
      {organization}
    );

    expect(
      screen.getByText(/they edit GitHub Actions workflow files/)
    ).toBeInTheDocument();
  });

  it('explains base branch drift without blaming the run', () => {
    render(
      <WorkflowFileWarning
        runState={makeRunState({
          'getsentry/sentry': makeRepoPRState({
            pr_creation_error_reason: 'workflow_drift',
          }),
        })}
      />,
      {organization}
    );

    expect(screen.getByText(/the base branch picked up/)).toBeInTheDocument();
  });

  it('asks the code changes card to open its retry prompt', async () => {
    render(
      <RetryStepProvider>
        <WorkflowFileWarning
          runState={makeRunState({'getsentry/sentry': makeRepoPRState()}, [
            makeBlock('code_changes'),
          ])}
        />
        <RequestedStep />
      </RetryStepProvider>,
      {organization}
    );

    expect(screen.getByText('requested: none')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(screen.getByText('requested: code_changes')).toBeInTheDocument();
  });
});
