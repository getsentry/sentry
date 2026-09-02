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
    autofixFormatted: null,
    startStep: jest.fn().mockResolvedValue(undefined),
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

  it('keeps the form rendered but inert when PR iteration is paused', async () => {
    const autofix = makeAutofix({
      runState: {run_id: 1, blocks: [], pr_iteration_paused: true} as any,
    });
    render(<PrIterationFeedbackForm autofix={autofix} groupId="1" runId={1} />);

    // The ticket asks for the form to stay visible, just greyed out.
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Submit'})).toBeDisabled();

    await userEvent.hover(screen.getByRole('button', {name: 'Submit'}));
    expect(
      await screen.findByText('PR iteration has been stopped for this Autofix run')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    expect(autofix.startStep).not.toHaveBeenCalled();
  });

  it('leaves the form usable when PR iteration is not paused', async () => {
    const autofix = makeAutofix();
    render(<PrIterationFeedbackForm autofix={autofix} groupId="1" runId={1} />);

    expect(screen.getByRole('textbox')).toBeEnabled();

    await userEvent.hover(screen.getByRole('button', {name: 'Submit'}));
    expect(
      screen.queryByText('PR iteration has been stopped for this Autofix run')
    ).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'make it blue');
    expect(screen.getByRole('button', {name: 'Submit'})).toBeEnabled();
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
