import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {toast} from '@sentry/scraps/toast';

import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {trackAnalytics} from 'sentry/utils/analytics';

import {PrIterationFeedbackForm} from './prIterationFeedbackForm';

jest.mock('sentry/utils/analytics');
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
    jest.spyOn(toast, 'error').mockClear();
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

  it('keeps the form rendered but inert when disabled', () => {
    const autofix = makeAutofix();
    render(<PrIterationFeedbackForm autofix={autofix} groupId="1" runId={1} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Submit'})).toBeDisabled();
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

  it('keeps the feedback when submit fails', async () => {
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

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Submit'})).toBeEnabled()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('make it blue');
    expect(trackAnalytics).not.toHaveBeenCalled();
    // startStep owns the error message, so the form must not add its own.
    expect(toast.error).not.toHaveBeenCalled();
  });
});
