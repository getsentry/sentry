import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {vstsIntegrationPipeline} from './pipelineIntegrationVsts';
import {createMakeStepProps, dispatchPipelineMessage, setupMockPopup} from './testUtils';

const VstsOAuthLoginStep = vstsIntegrationPipeline.steps[0].component;
const VstsAccountSelectionStep = vstsIntegrationPipeline.steps[1].component;

const makeStepProps = createMakeStepProps({totalSteps: 2});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('VstsOAuthLoginStep', () => {
  it('renders the OAuth login step for Azure DevOps', () => {
    render(
      <VstsOAuthLoginStep
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
      <VstsOAuthLoginStep
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

  it('disables authorize button when isInitializing', () => {
    render(
      <VstsOAuthLoginStep {...makeStepProps({stepData: null, isInitializing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Authorize Azure DevOps'})).toBeDisabled();
  });
});

describe('VstsAccountSelectionStep', () => {
  it('shows a no accounts message when no Azure DevOps organizations are available', () => {
    render(<VstsAccountSelectionStep {...makeStepProps({stepData: {accounts: []}})} />);

    expect(
      screen.getByText(
        'No Azure DevOps organizations were found for this account. Make sure you are an owner or admin on the Azure DevOps organization you want to connect.'
      )
    ).toBeInTheDocument();
  });

  it('calls advance when selecting an Azure DevOps organization', async () => {
    const advance = jest.fn();
    render(
      <VstsAccountSelectionStep
        {...makeStepProps({
          stepData: {
            accounts: [{accountId: 'acct-1', accountName: 'MyVSTSAccount'}],
          },
          advance,
        })}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Select Azure DevOps organization'})
    );
    await userEvent.click(await screen.findByText('MyVSTSAccount'));

    expect(advance).toHaveBeenCalledWith({account: 'acct-1'});
  });
});
