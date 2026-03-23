import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {gitlabIntegrationPipeline} from './pipelineIntegrationGitLab';
import type {PipelineStepProps} from './types';

const InstallationConfigStep = gitlabIntegrationPipeline.steps[0].component;
const GitLabOAuthLoginStep = gitlabIntegrationPipeline.steps[1].component;

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

describe('InstallationConfigStep', () => {
  it('renders the guided steps and config form', () => {
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {
            setupValues: [
              {
                label: 'Redirect URI',
                value: 'https://sentry.io/extensions/gitlab/setup/',
              },
            ],
          },
        })}
      />
    );

    expect(
      screen.getByText(
        'To connect Sentry with your GitLab instance, you need to create an OAuth application in GitLab.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Open GitLab application settings')).toBeInTheDocument();
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
                value: 'https://sentry.io/extensions/gitlab/setup/',
              },
              {label: 'Scopes', value: 'api'},
            ],
          },
        })}
      />
    );

    // Navigate to the create step
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByText('Redirect URI')).toBeInTheDocument();
    expect(
      screen.getByText('https://sentry.io/extensions/gitlab/setup/')
    ).toBeInTheDocument();
    expect(screen.getByText('Scopes')).toBeInTheDocument();
    expect(screen.getByText('api')).toBeInTheDocument();
  });

  it('submits config with required fields and calls advance', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {setupValues: []},
          advance,
        })}
      />
    );

    // Navigate through guided steps to the configure step
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab Application ID'}),
      'my-app-id'
    );
    await userEvent.type(screen.getByLabelText('GitLab Application Secret'), 'my-secret');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        url: undefined,
        verify_ssl: undefined,
        group: '',
        include_subgroups: undefined,
        client_id: 'my-app-id',
        client_secret: 'my-secret',
      });
    });
  });

  it('submits with group and include_subgroups when group is set', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {setupValues: []},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab Application ID'}),
      'my-app-id'
    );
    await userEvent.type(screen.getByLabelText('GitLab Application Secret'), 'my-secret');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab Group Path'}),
      'my-group/sub'
    );

    // Include Subgroups toggle should now be visible
    await userEvent.click(screen.getByRole('checkbox', {name: 'Include Subgroups'}));

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({
          group: 'my-group/sub',
          include_subgroups: true,
          client_id: 'my-app-id',
          client_secret: 'my-secret',
        })
      );
    });
  });

  it('does not show include_subgroups toggle when group is empty', async () => {
    render(<InstallationConfigStep {...makeStepProps({stepData: {setupValues: []}})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      screen.queryByRole('checkbox', {name: 'Include Subgroups'})
    ).not.toBeInTheDocument();
  });

  it('shows self-hosted fields when self-hosted toggle is enabled', async () => {
    render(<InstallationConfigStep {...makeStepProps({stepData: {setupValues: []}})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    // Self-hosted fields should not be visible initially
    expect(screen.queryByRole('textbox', {name: 'GitLab URL'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Self-Hosted Instance'}));

    expect(screen.getByRole('textbox', {name: 'GitLab URL'})).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Verify SSL'})).toBeInTheDocument();
  });

  it('submits self-hosted config with URL and verify_ssl', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {setupValues: []},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab Application ID'}),
      'my-app-id'
    );
    await userEvent.type(screen.getByLabelText('GitLab Application Secret'), 'my-secret');

    await userEvent.click(screen.getByRole('checkbox', {name: 'Self-Hosted Instance'}));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab URL'}),
      'https://gitlab.example.com/'
    );

    // Verify SSL is on by default, turn it off
    await userEvent.click(screen.getByRole('checkbox', {name: 'Verify SSL'}));

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://gitlab.example.com',
          verify_ssl: false,
          client_id: 'my-app-id',
          client_secret: 'my-secret',
        })
      );
    });
  });

  it('strips trailing slashes from self-hosted URL', async () => {
    const advance = jest.fn();
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {setupValues: []},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab Application ID'}),
      'id'
    );
    await userEvent.type(screen.getByLabelText('GitLab Application Secret'), 'secret');

    await userEvent.click(screen.getByRole('checkbox', {name: 'Self-Hosted Instance'}));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'GitLab URL'}),
      'https://gitlab.example.com///'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://gitlab.example.com',
        })
      );
    });
  });

  it('shows submitting state when isAdvancing is true', async () => {
    render(
      <InstallationConfigStep
        {...makeStepProps({
          stepData: {setupValues: []},
          isAdvancing: true,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByRole('button', {name: 'Submitting...'})).toBeDisabled();
  });
});

describe('GitLabOAuthLoginStep', () => {
  it('renders the OAuth login step for GitLab', () => {
    render(
      <GitLabOAuthLoginStep
        {...makeStepProps({stepData: {oauthUrl: 'https://gitlab.com/oauth/authorize'}})}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize GitLab'})).toBeInTheDocument();
  });

  it('calls advance with code and state on OAuth callback', async () => {
    const advance = jest.fn();
    render(
      <GitLabOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://gitlab.com/oauth/authorize'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

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
      <GitLabOAuthLoginStep
        {...makeStepProps({
          stepData: {oauthUrl: 'https://gitlab.com/oauth/authorize'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });

  it('disables authorize button when oauthUrl is not provided', () => {
    render(<GitLabOAuthLoginStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize GitLab'})).toBeDisabled();
  });
});
