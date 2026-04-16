import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {slackIntegrationPipeline} from './pipelineIntegrationSlack';
import type {PipelineStepProps} from './types';

const SlackOAuthLoginStep = slackIntegrationPipeline.steps[0].component;

function makeStepProps<D, A>(
  overrides: Partial<PipelineStepProps<D, A>> & {stepData: D}
): PipelineStepProps<D, A> {
  return {
    advance: jest.fn(),
    advanceError: null,
    isAdvancing: false,
    stepIndex: 0,
    totalSteps: 1,
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

describe('SlackOAuthLoginStep', () => {
  it('renders the OAuth login step for Slack', () => {
    render(
      <SlackOAuthLoginStep
        {...makeStepProps({stepData: {oauthUrl: 'https://slack.com/oauth/authorize'}})}
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
});
