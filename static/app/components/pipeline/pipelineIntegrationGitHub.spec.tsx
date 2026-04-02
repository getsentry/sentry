import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {githubIntegrationPipeline} from './pipelineIntegrationGitHub';
import type {PipelineStepProps} from './types';

const GitHubOAuthLoginStep = githubIntegrationPipeline.steps[0].component;
const OrgSelectionStep = githubIntegrationPipeline.steps[1].component;

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

describe('GitHubOAuthLoginStep', () => {
  it('renders the OAuth login step for GitHub', () => {
    render(
      <GitHubOAuthLoginStep
        {...makeStepProps({stepData: {oauthUrl: 'https://github.com/login/oauth'}})}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize GitHub'})).toBeInTheDocument();
  });

  it('calls advance with code, state, and installationId on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <GitHubOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://github.com/login/oauth'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitHub'}));

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'abc123',
        state: 'xyz789',
        installation_id: 'inst-42',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      code: 'abc123',
      state: 'xyz789',
      installationId: 'inst-42',
    });
  });

  it('shows loading state when isAdvancing is true', () => {
    render(
      <GitHubOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://github.com/login/oauth'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });
});

describe('OrgSelectionStep', () => {
  it('shows fresh install UI when there are no existing installations', () => {
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [],
          },
        })}
      />
    );

    expect(
      screen.getByText(
        'Install the Sentry GitHub App on a GitHub organization to get started.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Install GitHub App'})).toBeEnabled();
  });

  it('shows org selection dropdown when existing installations are present', () => {
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [
              {
                installationId: '100',
                githubAccount: 'my-org',
                avatarUrl: 'https://example.com/avatar.png',
                count: 0,
              },
            ],
          },
        })}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    ).toBeInTheDocument();
  });

  it('calls advance with chosenInstallationId when selecting an existing installation', async () => {
    const advance = jest.fn();
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [
              {
                installationId: '100',
                githubAccount: 'my-org',
                avatarUrl: 'https://example.com/avatar.png',
                count: 0,
              },
            ],
          },
          advance,
        })}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    );
    await userEvent.click(await screen.findByText('github.com/my-org'));

    expect(advance).toHaveBeenCalledWith({chosenInstallationId: '100'});
  });

  it('opens install popup when clicking new install option from dropdown', async () => {
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [
              {
                installationId: '100',
                githubAccount: 'my-org',
                avatarUrl: 'https://example.com/avatar.png',
                count: 0,
              },
            ],
          },
        })}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    );
    await userEvent.click(
      await screen.findByText('Install on a new GitHub organization')
    );

    expect(window.open).toHaveBeenCalledWith(
      'https://github.com/apps/sentry/installations/new',
      'pipeline_popup',
      expect.any(String)
    );
  });

  it('opens install popup from fresh install view and advances on callback', async () => {
    const advance = jest.fn();
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [],
          },
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Install GitHub App'}));

    expect(window.open).toHaveBeenCalledWith(
      'https://github.com/apps/sentry/installations/new',
      'pipeline_popup',
      expect.any(String)
    );

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        installation_id: 'new-inst-99',
      },
    });

    expect(advance).toHaveBeenCalledWith({installationId: 'new-inst-99'});
  });

  it('shows reopen button after popup is opened in fresh install view', async () => {
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [],
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Install GitHub App'}));

    expect(
      screen.getByText(
        'Complete the installation in the popup window. Once finished, this page will update automatically.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Reopen installation window'})
    ).toBeInTheDocument();
  });

  it('disables install button when installAppUrl is not provided', () => {
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {installationInfo: []},
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Install GitHub App'})).toBeDisabled();
  });

  it('shows popup blocked notice when popup fails to open', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);

    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [],
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

  it('shows completing state when isAdvancing in fresh install view', () => {
    render(
      <OrgSelectionStep
        {...makeStepProps({
          stepData: {
            installAppUrl: 'https://github.com/apps/sentry/installations/new',
            installationInfo: [],
          },
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Completing...'})).toBeDisabled();
  });
});
