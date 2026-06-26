import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {PrIterationFeedbackForm} from 'sentry/components/events/autofix/v3/prIterationFeedbackForm';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/actionCreators/indicator');

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState: {run_id: 1, blocks: []} as any,
    startStep: jest.fn().mockResolvedValue(undefined),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    isLoading: false,
    isPolling: false,
    ...overrides,
  };
}

describe('PrIterationFeedbackForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the submit button enabled while a run is polling', async () => {
    const autofix = makeAutofix({isPolling: true});
    render(<PrIterationFeedbackForm autofix={autofix} groupId="1" runId={1} />);

    await userEvent.type(screen.getByRole('textbox'), 'make it blue');
    expect(screen.getByRole('button', {name: 'Submit'})).toBeEnabled();
  });

  it('clears the input, resets state, and calls onClose after submitting', async () => {
    const autofix = makeAutofix();
    const onClose = jest.fn();
    render(
      <PrIterationFeedbackForm
        autofix={autofix}
        groupId="1"
        runId={1}
        onClose={onClose}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'make it blue');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    expect(autofix.startStep).toHaveBeenCalledWith('pr_iteration', {
      runId: 1,
      userContext: 'make it blue',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(textbox).toHaveValue('');
    expect(screen.getByRole('button', {name: 'Submit'})).toBeInTheDocument();
  });

  it('keeps the feedback and surfaces an error when submit fails', async () => {
    const autofix = makeAutofix({
      startStep: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const onClose = jest.fn();
    render(
      <PrIterationFeedbackForm
        autofix={autofix}
        groupId="1"
        runId={1}
        onClose={onClose}
      />
    );

    await userEvent.type(screen.getByRole('textbox'), 'make it blue');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('make it blue');
    expect(trackAnalytics).not.toHaveBeenCalled();
  });
});
