import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OAuthLoginStep} from './oauthLoginStep';

describe('OAuthLoginStep', () => {
  const mockOnOAuthCallback = jest.fn();
  let mockPopup: Window;

  beforeEach(() => {
    mockOnOAuthCallback.mockClear();
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
      window.dispatchEvent(
        new MessageEvent('message', {data, origin, source: source as Window})
      );
    });
  }

  it('renders the authorize button with the service name', () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize GitLab'})).toBeInTheDocument();
    expect(
      screen.getByText(
        'Authorize your GitLab account with Sentry to complete the integration setup.'
      )
    ).toBeInTheDocument();
  });

  it('disables the authorize button when no oauthUrl is provided', () => {
    render(<OAuthLoginStep serviceName="GitHub" onOAuthCallback={mockOnOAuthCallback} />);

    expect(screen.getByRole('button', {name: 'Authorize GitHub'})).toBeDisabled();
  });

  it('opens a popup when the authorize button is clicked', async () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    expect(window.open).toHaveBeenCalledWith(
      'https://gitlab.com/oauth/authorize',
      'pipeline_popup',
      expect.any(String)
    );
  });

  it('shows waiting state after popup is opened', async () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    expect(
      screen.getByText('A popup should have opened to authorize with GitLab.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Reopen authorization window'})
    ).toBeInTheDocument();
  });

  it('calls onOAuthCallback when postMessage is received from the popup', async () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code-123',
        state: 'state-456',
        installation_id: 'inst-789',
      },
    });

    expect(mockOnOAuthCallback).toHaveBeenCalledWith({
      code: 'auth-code-123',
      state: 'state-456',
      rest: {installation_id: 'inst-789'},
    });
  });

  it('ignores postMessage from non-pipeline sources', async () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    dispatchPipelineMessage({
      data: {source: 'some-extension', code: 'nope'},
    });

    expect(mockOnOAuthCallback).not.toHaveBeenCalled();
  });

  it('ignores postMessage from an untrusted origin', async () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code-123',
        state: 'state-456',
      },
      origin: 'https://evil.example.com',
    });

    expect(mockOnOAuthCallback).not.toHaveBeenCalled();
  });

  it('ignores postMessage not from the popup window', async () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code-123',
        state: 'state-456',
      },
      source: null,
    });

    expect(mockOnOAuthCallback).not.toHaveBeenCalled();
  });

  it('shows warning when popup is blocked by the browser', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);

    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize GitLab'}));

    expect(
      screen.getByText(
        'The authorization popup was blocked by your browser. Please ensure popups are allowed and try again.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('A popup should have opened to authorize with GitLab.')
    ).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <OAuthLoginStep
        serviceName="GitLab"
        oauthUrl="https://gitlab.com/oauth/authorize"
        isLoading
        onOAuthCallback={mockOnOAuthCallback}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });
});
