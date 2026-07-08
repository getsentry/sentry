import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {claudeCodeIntegrationPipeline} from '.';

const ClaudeCodeApiKeyStep = claudeCodeIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('ClaudeCodeApiKeyStep', () => {
  it('renders the API key form', () => {
    render(<ClaudeCodeApiKeyStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
    expect(screen.getByLabelText('Anthropic API Key')).toBeInTheDocument();
  });

  it('calls advance with API key on submit', async () => {
    const advance = jest.fn();
    render(<ClaudeCodeApiKeyStep {...makeStepProps({stepData: {}, advance})} />);

    await userEvent.type(screen.getByLabelText('Anthropic API Key'), 'sk-ant-test-key');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({apiKey: 'sk-ant-test-key'});
    });
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <ClaudeCodeApiKeyStep {...makeStepProps({stepData: {}, isAdvancing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('disables submit button when isInitializing', () => {
    render(
      <ClaudeCodeApiKeyStep {...makeStepProps({stepData: null, isInitializing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });
});
