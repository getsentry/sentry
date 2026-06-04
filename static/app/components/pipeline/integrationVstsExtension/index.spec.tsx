import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {vstsExtensionIntegrationPipeline} from '.';

const VstsExtensionOAuthLoginStep = vstsExtensionIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('VstsExtensionOAuthLoginStep', () => {
  it('is the only step (no account selection)', () => {
    expect(vstsExtensionIntegrationPipeline.steps).toHaveLength(1);
  });

  it('renders the OAuth login step for Azure DevOps', () => {
    render(
      <VstsExtensionOAuthLoginStep
        {...makeStepProps({
          stepData: {
            oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          },
        })}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Authorize Azure DevOps'})
    ).toBeInTheDocument();
  });

  it('calls advance with code and state on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <VstsExtensionOAuthLoginStep
        {...makeStepProps({
          stepData: {
            oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          },
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Azure DevOps'}));

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
});
