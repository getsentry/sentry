import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {discordIntegrationPipeline} from './pipelineIntegrationDiscord';
import type {PipelineStepProps} from './types';

const DiscordOAuthLoginStep = discordIntegrationPipeline.steps[0].component;

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

describe('DiscordOAuthLoginStep', () => {
  it('renders the OAuth login step for Discord', () => {
    render(
      <DiscordOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://discord.com/api/oauth2/authorize'},
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize Discord'})).toBeInTheDocument();
  });

  it('calls advance with code, state, and guildId on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <DiscordOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://discord.com/api/oauth2/authorize'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Discord'}));

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code-123',
        state: 'state-xyz',
        guild_id: '1234567890',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      code: 'auth-code-123',
      state: 'state-xyz',
      guildId: '1234567890',
    });
  });

  it('shows loading state when isAdvancing is true', () => {
    render(
      <DiscordOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://discord.com/api/oauth2/authorize'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });

  it('disables authorize button when oauthUrl is not provided', () => {
    render(<DiscordOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize Discord'})).toBeDisabled();
  });
});
