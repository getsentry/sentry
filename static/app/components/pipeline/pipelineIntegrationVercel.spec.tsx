import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {vercelIntegrationPipeline} from './pipelineIntegrationVercel';
import {createMakeStepProps, dispatchPipelineMessage, setupMockPopup} from './testUtils';

const VercelOAuthLoginStep = vercelIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('VercelOAuthLoginStep', () => {
  it('renders the OAuth login step for Vercel', () => {
    render(
      <VercelOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://vercel.com/oauth/authorize'},
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize Vercel'})).toBeInTheDocument();
  });

  it('calls advance with code and state on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <VercelOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://vercel.com/oauth/authorize'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Vercel'}));

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
      <VercelOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://vercel.com/oauth/authorize'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });

  it('disables authorize button when oauthUrl is not provided', () => {
    render(<VercelOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize Vercel'})).toBeDisabled();
  });

  it('disables authorize button when isInitializing', () => {
    render(
      <VercelOAuthLoginStep {...makeStepProps({stepData: null, isInitializing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Authorize Vercel'})).toBeDisabled();
  });
});
