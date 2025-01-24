import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutofixChanges} from './autofixChanges';
import {AutofixStatus, AutofixStepType} from './types';

const mockUseAutofix = jest.fn();
jest.mock('sentry/components/events/autofix/useAutofix', () => ({
  ...jest.requireActual('sentry/components/events/autofix/useAutofix'),
  useAutofixData: () => mockUseAutofix(),
}));

const mockUseAutofixSetup = jest.fn();
jest.mock('sentry/components/events/autofix/useAutofixSetup', () => ({
  useAutofixSetup: () => mockUseAutofixSetup(),
}));

const mockUpdateInsightCard = jest.fn();
jest.mock('sentry/components/events/autofix/autofixInsightCards', () => ({
  useUpdateInsightCard: () => ({
    mutate: mockUpdateInsightCard,
  }),
}));

describe('AutofixChanges', () => {
  const defaultProps = {
    groupId: '123',
    runId: 'run-123',
    step: {
      id: 'step-123',
      progress: [],
      title: 'Changes',
      type: AutofixStepType.CHANGES as const,
      index: 0,
      status: AutofixStatus.COMPLETED,
      changes: [AutofixCodebaseChangeData({pull_request: undefined})],
    },
  };

  beforeEach(() => {
    mockUseAutofix.mockReturnValue({
      status: 'COMPLETED',
      steps: [
        {
          type: AutofixStepType.DEFAULT,
          index: 0,
          insights: [],
        },
      ],
    });

    mockUseAutofixSetup.mockReturnValue({
      data: {
        githubWriteIntegration: {
          repos: [
            {
              owner: 'getsentry',
              name: 'sentry',
              ok: true,
            },
          ],
        },
      },
    });
  });

  it('renders error state when step has error', () => {
    render(
      <AutofixChanges
        {...defaultProps}
        step={{
          ...defaultProps.step,
          status: AutofixStatus.ERROR,
        }}
      />
    );

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  it('renders empty state when no changes', () => {
    render(
      <AutofixChanges
        {...defaultProps}
        step={{
          ...defaultProps.step,
          changes: [],
        }}
      />
    );

    expect(screen.getByText('Could not find a fix.')).toBeInTheDocument();
  });

  it('renders changes with action buttons', () => {
    render(<AutofixChanges {...defaultProps} />);

    expect(screen.getByText('Fixes')).toBeInTheDocument();
    expect(screen.getByText('Add error handling')).toBeInTheDocument();
    expect(screen.getByText('owner/hello-world')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Add Tests'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Check Out Locally'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Draft PR'})).toBeInTheDocument();
  });

  it('shows PR links when PRs are created', () => {
    const changeWithPR = AutofixCodebaseChangeData({
      pull_request: {
        pr_number: 123,
        pr_url: 'https://github.com/owner/hello-world/pull/123',
      },
    });

    render(
      <AutofixChanges
        {...defaultProps}
        step={{
          ...defaultProps.step,
          changes: [changeWithPR],
        }}
      />
    );

    expect(
      screen.getByRole('button', {name: 'View PR in owner/hello-world'})
    ).toBeInTheDocument();
  });

  it('shows branch checkout buttons when branches are created', () => {
    const changeWithBranch = AutofixCodebaseChangeData({
      branch_name: 'fix/issue-123',
      pull_request: undefined,
    });

    render(
      <AutofixChanges
        {...defaultProps}
        step={{
          ...defaultProps.step,
          changes: [changeWithBranch],
        }}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Check out in owner/hello-world'})
    ).toBeInTheDocument();
  });
});
