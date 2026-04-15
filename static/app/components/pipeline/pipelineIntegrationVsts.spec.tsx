import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {vstsIntegrationPipeline} from './pipelineIntegrationVsts';
import type {PipelineStepProps} from './types';

const VstsOAuthLoginStep = vstsIntegrationPipeline.steps[0].component;
const VstsAccountSelectionStep = vstsIntegrationPipeline.steps[1].component;

function makeStepProps<D, A>(
  overrides: Partial<PipelineStepProps<D, A>> & {stepData: D}
): PipelineStepProps<D, A> {
  return {
    advance: jest.fn(),
    advanceError: null,
    isAdvancing: false,
    stepIndex: 0,
    totalSteps: 2,
    ...overrides,
  };
}

let mockPopup: Window;

function dispatchPipelineMessage({
  data,
  origin = document.location.origin,
  source = mockPopup,
}: {
  data: Record<string, string>;
  origin?: string;
  source?: Window | MessageEventSource | null;
}) {
  act(() => {
    const event = new MessageEvent('message', {data, origin});
    Object.defineProperty(event, 'source', {value: source});
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  mockPopup = {
    closed: false,
    close: jest.fn(),
    focus: jest.fn(),
  } as unknown as Window;
  jest.spyOn(window, 'open').mockReturnValue(mockPopup);
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
