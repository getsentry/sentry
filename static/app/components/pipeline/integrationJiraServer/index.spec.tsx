import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {jiraServerIntegrationPipeline} from '.';

const InstallationConfigStep = jiraServerIntegrationPipeline.steps[0].component;
const OAuthCallbackStep = jiraServerIntegrationPipeline.steps[1].component;

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
    screen.getByRole('textbox', {name: 'Jira URL'}),
    'https://jira.example.com'
  );
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Jira Consumer Key'}),
    'sentry-bot'
  );
  await userEvent.type(
    screen.getByRole('textbox', {name: 'Jira Consumer Private Key'}),
    '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----'
  );
}

describe('Jira Server InstallationConfigStep', () => {
  it('renders the config form fields', () => {
    render(<InstallationConfigStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('textbox', {name: 'Jira URL'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Jira Consumer Key'})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Jira Consumer Private Key'})
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
        url: 'https://jira.example.com',
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
    await userEvent.clear(screen.getByRole('textbox', {name: 'Jira URL'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Jira URL'}),
      'https://jira.example.com///'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({url: 'https://jira.example.com'})
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

describe('Jira Server OAuthCallbackStep', () => {
  const oauthUrl =
    'https://jira.example.com/plugins/servlet/oauth/authorize?oauth_token=req-token';

  it('renders the authorize button', () => {
    render(<OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}})} />);

    expect(
      screen.getByRole('button', {name: 'Authorize Jira Server'})
    ).toBeInTheDocument();
  });

  it('opens the popup and advances with oauthToken on callback', async () => {
    const advance = jest.fn();
    render(<OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}, advance})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Jira Server'}));

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

    expect(screen.getByRole('button', {name: 'Authorize Jira Server'})).toBeDisabled();
  });

  it('shows popup-blocked notice when window.open returns null', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);

    render(<OAuthCallbackStep {...makeStepProps({stepData: {oauthUrl}})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Jira Server'}));

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

    expect(screen.getByRole('button', {name: 'Authorize Jira Server'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});
