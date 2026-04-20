import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {slackIntegrationPipeline} from './pipelineIntegrationSlack';
import {createMakeStepProps, dispatchPipelineMessage, setupMockPopup} from './testUtils';

const SlackOAuthLoginStep = slackIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SlackOAuthLoginStep', () => {
  it('renders the OAuth login step for Slack', () => {
    render(
      <SlackOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://slack.com/oauth/authorize'},
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize Slack'})).toBeInTheDocument();
  });

  it('calls advance with code and state on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <SlackOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://slack.com/oauth/authorize'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Slack'}));

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code-123',
        state: 'state-xyz',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      code: 'auth-code-123',
      state: 'state-xyz',
    });
  });

  it('shows loading state when isAdvancing is true', () => {
    render(
      <SlackOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://slack.com/oauth/authorize'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });

  it('disables authorize button when oauthUrl is not provided', () => {
    render(<SlackOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize Slack'})).toBeDisabled();
  });

  it('disables authorize button when isInitializing', () => {
    render(
      <SlackOAuthLoginStep {...makeStepProps({stepData: null, isInitializing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Authorize Slack'})).toBeDisabled();
  });
});
