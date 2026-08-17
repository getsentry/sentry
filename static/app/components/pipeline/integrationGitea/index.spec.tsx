import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {giteaIntegrationPipeline} from '.';

const InstallationConfigStep = giteaIntegrationPipeline.steps[0].component;
const GiteaOAuthLoginStep = giteaIntegrationPipeline.steps[1].component;

const makeStepProps = createMakeStepProps({totalSteps: 2});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function goToConfigureStep() {
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
}

describe('InstallationConfigStep', () => {
  it('renders the guided steps and config form', () => {
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {
            setupValues: [
              {
                label: 'Redirect URI',
                value: 'https://sentry.io/extensions/gitea/setup/',
              },
            ],
          },
        })}
      />
    );

    expect(
      screen.getByText(
        'To connect Sentry with your Gitea instance, you need to create an OAuth application in Gitea.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Open Gitea application settings')).toBeInTheDocument();
    expect(screen.getByText('Create a new application')).toBeInTheDocument();
    expect(screen.getByText('Configure the integration')).toBeInTheDocument();
  });

  it('renders setup values in the create step', async () => {
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {
            setupValues: [
              {
                label: 'Redirect URI',
                value: 'https://sentry.io/extensions/gitea/setup/',
              },
              {label: 'Scopes', value: 'read:repository write:repository read:user'},
            ],
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByText('Redirect URI')).toBeInTheDocument();
    expect(
      screen.getByText('https://sentry.io/extensions/gitea/setup/')
    ).toBeInTheDocument();
    expect(screen.getByText('Scopes')).toBeInTheDocument();
    expect(
      screen.getByText('read:repository write:repository read:user')
    ).toBeInTheDocument();
  });

  it('submits the instance URL and OAuth credentials', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({stepData: {setupValues: []}, advance})}
      />
    );

    await goToConfigureStep();

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Gitea URL'}),
      'https://gitea.example.com'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Client ID'}),
      'my-client-id'
    );
    await userEvent.type(screen.getByLabelText('Client Secret'), 'my-secret');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        url: 'https://gitea.example.com',
        client_id: 'my-client-id',
        client_secret: 'my-secret',
      });
    });
  });

  it('keeps sub-path installs intact and strips trailing slashes', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({stepData: {setupValues: []}, advance})}
      />
    );

    await goToConfigureStep();

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Gitea URL'}),
      'https://example.com/gitea///'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Client ID'}), 'id');
    await userEvent.type(screen.getByLabelText('Client Secret'), 'secret');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({url: 'https://example.com/gitea'})
      );
    });
  });

  it('does not advance without a valid URL', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({stepData: {setupValues: []}, advance})}
      />
    );

    await goToConfigureStep();

    await userEvent.type(screen.getByRole('textbox', {name: 'Gitea URL'}), 'not-a-url');
    await userEvent.type(screen.getByRole('textbox', {name: 'Client ID'}), 'id');
    await userEvent.type(screen.getByLabelText('Client Secret'), 'secret');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByText('A valid Gitea URL is required')).toBeInTheDocument();
    expect(advance).not.toHaveBeenCalled();
  });

  it('shows busy state when isAdvancing is true', async () => {
    render(
      <InstallationConfigStep
        {...makeStepProps({stepData: {setupValues: []}, isAdvancing: true})}
      />
    );

    await goToConfigureStep();

    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('disables submit button when isInitializing', async () => {
    render(
      <InstallationConfigStep
        {...makeStepProps({stepData: null, isInitializing: true})}
      />
    );

    await goToConfigureStep();

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });
});

describe('GiteaOAuthLoginStep', () => {
  it('renders the OAuth login step for Gitea', () => {
    render(
      <GiteaOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://gitea.example.com/login/oauth/authorize'},
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize Gitea'})).toBeInTheDocument();
  });

  it.isKnownFlake('calls advance with code and state on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <GiteaOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://gitea.example.com/login/oauth/authorize'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Gitea'}));

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

  it('disables authorize button when oauthUrl is not provided', () => {
    render(<GiteaOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize Gitea'})).toBeDisabled();
  });
});
