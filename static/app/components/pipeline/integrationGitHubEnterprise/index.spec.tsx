import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {githubEnterpriseIntegrationPipeline} from '.';

const InstallationConfigStep = githubEnterpriseIntegrationPipeline.steps[0].component;
const AppInstallRedirectStep = githubEnterpriseIntegrationPipeline.steps[1].component;
const GHEOAuthLoginStep = githubEnterpriseIntegrationPipeline.steps[2].component;

const makeStepProps = createMakeStepProps({totalSteps: 3});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function fillRequiredConfigFields() {
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Installation URL'}),
    'https://github.example.com'
  );
  await userEvent.type(screen.getByRole('textbox', {name: 'GitHub App ID'}), '1');
  await userEvent.type(
    screen.getByRole('textbox', {name: 'GitHub App Name'}),
    'sentry-app'
  );
  await userEvent.type(screen.getByLabelText('Webhook Secret'), 'webhook-secret');
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Private Key'}),
    '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----'
  );
  await userEvent.type(
    screen.getByRole('textbox', {name: 'OAuth Client ID'}),
    'client-id'
  );
  await userEvent.type(screen.getByLabelText('OAuth Client Secret'), 'client-secret');
}

describe('GHE InstallationConfigStep', () => {
  it('renders the config form fields', () => {
    render(<InstallationConfigStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('textbox', {name: 'Installation URL'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'GitHub App ID'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'GitHub App Name'})).toBeInTheDocument();
    expect(screen.getByLabelText('Webhook Secret')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Private Key'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'OAuth Client ID'})).toBeInTheDocument();
    expect(screen.getByLabelText('OAuth Client Secret')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('calls advance with form data on submit', async () => {
    const advance = jest.fn();
    render(<InstallationConfigStep {...makeStepProps({stepData: {}, advance})} />);

    await fillRequiredConfigFields();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        url: 'https://github.example.com',
        id: '1',
        name: 'sentry-app',
        publicLink: '',
        verifySsl: true,
        webhookSecret: 'webhook-secret',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      });
    });
  });

  it('strips trailing slashes from the installation URL', async () => {
    const advance = jest.fn();
    render(<InstallationConfigStep {...makeStepProps({stepData: {}, advance})} />);

    await fillRequiredConfigFields();
    await userEvent.clear(screen.getByRole('textbox', {name: 'Installation URL'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Installation URL'}),
      'https://github.example.com///'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({url: 'https://github.example.com'})
      );
    });
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <InstallationConfigStep {...makeStepProps({stepData: {}, isAdvancing: true})} />
    );

    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});

describe('GHE AppInstallRedirectStep', () => {
  it('opens the install popup and advances on installation_id callback', async () => {
    const advance = jest.fn();
    render(
      <AppInstallRedirectStep
        {...makeStepProps({
          stepData: {
            appInstallUrl: 'https://github.example.com/github-apps/sentry-app',
          },
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Install GitHub App'}));

    expect(window.open).toHaveBeenCalledWith(
      'https://github.example.com/github-apps/sentry-app',
      'pipeline_popup',
      expect.any(String)
    );

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        installation_id: 'inst-42',
      },
    });

    expect(advance).toHaveBeenCalledWith({installationId: 'inst-42'});
  });

  it('shows reopen button after popup opens', async () => {
    render(
      <AppInstallRedirectStep
        {...makeStepProps({
          stepData: {
            appInstallUrl: 'https://github.example.com/github-apps/sentry-app',
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Install GitHub App'}));

    expect(
      screen.getByText(
        'Complete the installation in the popup window. This page will update automatically.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Reopen installation window'})
    ).toBeInTheDocument();
  });

  it('disables the install button when appInstallUrl is not provided', () => {
    render(<AppInstallRedirectStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Install GitHub App'})).toBeDisabled();
  });

  it('shows popup-blocked notice when window.open returns null', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);

    render(
      <AppInstallRedirectStep
        {...makeStepProps({
          stepData: {
            appInstallUrl: 'https://github.example.com/github-apps/sentry-app',
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Install GitHub App'}));

    expect(
      screen.getByText(
        'The installation popup was blocked by your browser. Please ensure popups are allowed and try again.'
      )
    ).toBeInTheDocument();
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <AppInstallRedirectStep
        {...makeStepProps({
          stepData: {
            appInstallUrl: 'https://github.example.com/github-apps/sentry-app',
          },
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Install GitHub App'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});

describe('GHE OAuthLoginStep', () => {
  it('renders the OAuth login step', () => {
    render(
      <GHEOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://github.example.com/login/oauth/authorize'},
        })}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Authorize GitHub Enterprise'})
    ).toBeInTheDocument();
  });

  it('calls advance with code and state on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <GHEOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://github.example.com/login/oauth/authorize'},
          advance,
        })}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Authorize GitHub Enterprise'})
    );

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code',
        state: 'state-xyz',
      },
    });

    expect(advance).toHaveBeenCalledWith({code: 'auth-code', state: 'state-xyz'});
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <GHEOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://github.example.com/login/oauth/authorize'},
          isAdvancing: true,
        })}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Authorize GitHub Enterprise'})
    ).toHaveAttribute('aria-busy', 'true');
  });

  it('disables authorize button when oauthUrl is missing', () => {
    render(<GHEOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(
      screen.getByRole('button', {name: 'Authorize GitHub Enterprise'})
    ).toBeDisabled();
  });
});
