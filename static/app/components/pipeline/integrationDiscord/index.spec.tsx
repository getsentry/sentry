import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {discordIntegrationPipeline} from '.';

const DiscordOAuthLoginStep = discordIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
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
      source: mockPopup,
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

  it('shows busy state when isAdvancing is true', () => {
    render(
      <DiscordOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://discord.com/api/oauth2/authorize'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize Discord'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('disables authorize button when oauthUrl is not provided', () => {
    render(<DiscordOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize Discord'})).toBeDisabled();
  });

  it('disables authorize button when isInitializing', () => {
    render(
      <DiscordOAuthLoginStep {...makeStepProps({stepData: null, isInitializing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Authorize Discord'})).toBeDisabled();
  });

  it('auto-advances when stepData indicates an App Directory install', () => {
    const advance = jest.fn();
    render(
      <DiscordOAuthLoginStep
        {...makeStepProps({
          stepData: {
            appDirectoryInstall: true,
            code: 'auth-code-456',
            guildId: '9876543210',
            state: 'pipeline-sig',
          },
          advance,
        })}
      />
    );

    expect(advance).toHaveBeenCalledWith({
      code: 'auth-code-456',
      guildId: '9876543210',
      state: 'pipeline-sig',
    });
    expect(advance).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', {name: 'Authorize Discord'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Finishing up Discord integration installation...')
    ).toBeInTheDocument();
  });
});
