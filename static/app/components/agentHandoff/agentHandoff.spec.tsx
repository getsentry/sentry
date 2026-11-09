import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {AgentHandoff} from './agentHandoff';
import {AgentHandoffFlow} from './useAgentHandoff';

function TestAgentHandoff() {
  return (
    <AgentHandoff flow={AgentHandoffFlow.ONBOARDING}>
      <AgentHandoff.Details />
    </AgentHandoff>
  );
}

describe('AgentHandoff', () => {
  const organization = OrganizationFixture();
  const promptUrl = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const prompt = 'Fetch the guide. Your secret token is `sntryh_example`.';
  const warning = /Don’t paste it while screen sharing or recording/;
  const writeText = jest.fn();

  function mockPrompt() {
    return MockApiClient.addMockResponse({
      url: promptUrl,
      method: 'POST',
      body: {prompt, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});
  });

  it('copies an IP-pinned handoff inline', async () => {
    const mint = mockPrompt();
    render(<TestAgentHandoff />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
    expect(mint).toHaveBeenCalledWith(
      promptUrl,
      expect.objectContaining({
        data: {flow: 'onboarding', disableIpPinning: false},
      })
    );
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
  });

  it('copies the complete prompt when using the native copy command', async () => {
    mockPrompt();
    render(<TestAgentHandoff />, {organization});

    fireEvent.copy(screen.getByText('`sntryh_*`'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
  });

  it('shows the handoff URL with a masked token', () => {
    render(<TestAgentHandoff />, {organization});

    expect(screen.getByText(/\/agent-handoff\//)).toBeInTheDocument();
    expect(screen.getByText('`sntryh_*`')).toBeInTheDocument();
  });

  it('explains what the masked token is used for', async () => {
    render(<TestAgentHandoff />, {organization});

    await userEvent.hover(screen.getByText('`sntryh_*`'));

    expect(
      await screen.findByText('The secret token authenticates the CLI via this prompt')
    ).toBeInTheDocument();
  });

  it('selects the complete prompt on pointer down', async () => {
    render(<TestAgentHandoff />, {organization});
    const promptText = screen.getByText('`sntryh_*`');

    await userEvent.pointer({keys: '[MouseLeft>]', target: promptText});

    expect(window.getSelection()?.toString()).toContain('/agent-handoff/');
    expect(window.getSelection()?.toString()).toContain('sntryh_*');
    await userEvent.pointer({keys: '[/MouseLeft]', target: promptText});
    window.getSelection()?.removeAllRanges();
  });

  it('warns when disabling IP pinning and copies that choice', async () => {
    const mint = mockPrompt();
    render(<TestAgentHandoff />, {organization});
    expect(screen.queryByText(warning)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Advanced options'}));
    const checkbox = screen.getByRole('checkbox', {name: 'Disable IP pinning'});
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAccessibleDescription(
      /Only enable this option if your agent runs on a different machine/
    );
    await userEvent.click(checkbox);
    expect(screen.getByText(warning)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Advanced options'}));
    expect(screen.getByText(warning)).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Advanced options'}));
    await userEvent.click(checkbox);
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
    expect(mint).toHaveBeenCalledWith(
      promptUrl,
      expect.objectContaining({
        data: {flow: 'onboarding', disableIpPinning: true},
      })
    );
  });

  it('mints a new handoff when pinning changes after a clipboard failure', async () => {
    const mint = mockPrompt();
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    render(<TestAgentHandoff />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));
    await screen.findByText(
      'Unable to copy your agent prompt. Allow clipboard access and try again.'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Advanced options'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Disable IP pinning'}));
    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(mint).toHaveBeenCalledTimes(2);
    expect(mint).toHaveBeenLastCalledWith(
      promptUrl,
      expect.objectContaining({
        data: {flow: 'onboarding', disableIpPinning: true},
      })
    );
  });

  it('links to a redacted preview of the handoff markdown', () => {
    render(<TestAgentHandoff />, {organization});

    expect(
      screen.getByRole('link', {name: 'Preview the handoff markdown'})
    ).toHaveAttribute('href', 'https://sentry.io/agent-handoff/?preview=1');
  });
});
