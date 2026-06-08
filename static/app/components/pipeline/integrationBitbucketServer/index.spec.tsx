import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {bitbucketServerIntegrationPipeline} from '.';

const InstallationConfigStep = bitbucketServerIntegrationPipeline.steps[0].component;
const OAuthCallbackStep = bitbucketServerIntegrationPipeline.steps[1].component;

const makeStepProps = createMakeStepProps({totalSteps: 2});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function fillRequiredConfigFields() {
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Bitbucket URL'}),
    'https://bitbucket.example.com'
  );
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Bitbucket Consumer Key'}),
    'sentry-bot'
  );
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Bitbucket Consumer Private Key'}),
    '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----'
  );
}

describe('Bitbucket Server InstallationConfigStep', () => {
  it('renders the config form fields', () => {
    render(<InstallationConfigStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('textbox', {name: 'Bitbucket URL'})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Bitbucket Consumer Key'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Bitbucket Consumer Private Key'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('calls advance with form data on submit', async () => {
    const advance = jest.fn();
    render(<InstallationConfigStep {...makeStepProps({stepData: {}, advance})} />);

    await fillRequiredConfigFields();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        url: 'https://bitbucket.example.com',
        consumerKey: 'sentry-bot',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
        verifySsl: true,
      });
    });
  });

  it('strips trailing slashes from the URL', async () => {
    const advance = jest.fn();
    render(<InstallationConfigStep {...makeStepProps({stepData: {}, advance})} />);

    await fillRequiredConfigFields();
    await userEvent.clear(screen.getByRole('textbox', {name: 'Bitbucket URL'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Bitbucket URL'}),
      'https://bitbucket.example.com///'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({url: 'https://bitbucket.example.com'})
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

describe('Bitbucket Server OAuthCallbackStep', () => {
  const oauthUrl =
    'https://bitbucket.example.com/plugins/servlet/oauth/authorize?oauth_token=req-token';

  it('renders the authorize button', () => {
    render(<OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}})} />);

    expect(
      screen.getByRole('button', {name: 'Authorize Bitbucket Server'})
    ).toBeInTheDocument();
  });

  it('opens the popup and advances with oauthToken on callback', async () => {
    const advance = jest.fn();
    render(<OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}, advance})} />);

    await userEvent.click(
      screen.getByRole('button', {name: 'Authorize Bitbucket Server'})
    );

    expect(window.open).toHaveBeenCalledWith(
      oauthUrl,
      'pipeline_popup',
      expect.any(String)
    );

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        oauth_token: 'callback-token',
      },
    });

    expect(advance).toHaveBeenCalledWith({oauthToken: 'callback-token'});
  });

  it('disables the authorize button when oauthUrl is missing', () => {
    render(<OAuthCallbackStep {...makeStepProps({stepData: {}})} />);

    expect(
      screen.getByRole('button', {name: 'Authorize Bitbucket Server'})
    ).toBeDisabled();
  });

  it('shows popup-blocked notice when window.open returns null', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);

    render(<OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}})} />);

    await userEvent.click(
      screen.getByRole('button', {name: 'Authorize Bitbucket Server'})
    );

    expect(
      screen.getByText(
        'The authorization popup was blocked by your browser. Please ensure popups are allowed and try again.'
      )
    ).toBeInTheDocument();
  });

  it('shows busy state when isAdvancing', () => {
    render(
      <OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}, isAdvancing: true})} />
    );

    expect(
      screen.getByRole('button', {name: 'Authorize Bitbucket Server'})
    ).toHaveAttribute('aria-busy', 'true');
  });
});
