import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {cursorIntegrationPipeline} from './pipelineIntegrationCursor';
import {createMakeStepProps} from './testUtils';

const CursorApiKeyStep = cursorIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('CursorApiKeyStep', () => {
  it('renders the API key form', () => {
    render(<CursorApiKeyStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
    expect(screen.getByLabelText('Cursor API Key')).toBeInTheDocument();
  });

  it('calls advance with API key on submit', async () => {
    const advance = jest.fn();
    render(<CursorApiKeyStep {...makeStepProps({stepData: {}, advance})} />);

    await userEvent.type(screen.getByLabelText('Cursor API Key'), 'cursor-api-key-123');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({apiKey: 'cursor-api-key-123'});
    });
  });

  it('shows loading state when isAdvancing', () => {
    render(<CursorApiKeyStep {...makeStepProps({stepData: {}, isAdvancing: true})} />);

    expect(screen.getByRole('button', {name: 'Submitting...'})).toBeDisabled();
  });

  it('disables submit button when isInitializing', () => {
    render(
      <CursorApiKeyStep {...makeStepProps({stepData: null, isInitializing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });
});
