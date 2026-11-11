import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {AgentHandoffPrompt} from './agentHandoffPrompt';
import {AgentHandoffFlow} from './useAgentHandoff';

describe('AgentHandoffPrompt', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const context = {runId: 'a'.repeat(32)};
  const feedbackSource = 'agent-handoff-prompt-test';
  const prompt =
    'Fetch and follow the instructions at https://sentry.io/agent-handoff/. Your secret token is `sntryh_example`.';
  const write = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    class TestClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    Object.assign(globalThis, {ClipboardItem: TestClipboardItem});
    write.mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {write}});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
  });

  it('copies a private prompt with IP pinning enabled', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {prompt, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    const onCopySuccess = jest.fn();

    render(
      <AgentHandoffPrompt
        context={context}
        feedbackSource={feedbackSource}
        flow={AgentHandoffFlow.ONBOARDING}
        onCopySuccess={onCopySuccess}
      />,
      {organization}
    );

    expect(screen.getByRole('link', {name: 'See the full instructions'})).toHaveAttribute(
      'href',
      'https://sentry.io/agent-handoff/?preview=1&flow=onboarding'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));

    await waitFor(() => expect(onCopySuccess).toHaveBeenCalledTimes(1));
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          context,
          disableIpPinning: false,
          flow: 'onboarding',
        },
      })
    );
    const item = write.mock.calls[0]![0][0] as {
      data: Record<string, Promise<Blob>>;
    };
    await expect(item.data['text/plain']!.then(blob => blob.text())).resolves.toBe(
      prompt
    );
  });

  it('can disable IP pinning before copying', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {prompt, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    render(
      <AgentHandoffPrompt
        context={context}
        feedbackSource={feedbackSource}
        flow={AgentHandoffFlow.ONBOARDING}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Advanced options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: /Use IP pinning/}));

    expect(
      screen.getByText(/Without IP pinning, anyone with this prompt can use it/)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));

    await waitFor(() =>
      expect(mint).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          data: {
            context,
            disableIpPinning: true,
            flow: 'onboarding',
          },
        })
      )
    );
  });

  it('selects the masked prompt on pointer down', async () => {
    const onSelect = jest.fn();
    render(
      <Fragment>
        <input aria-label="Prior input" />
        <AgentHandoffPrompt
          context={context}
          feedbackSource={feedbackSource}
          flow={AgentHandoffFlow.ONBOARDING}
          onSelect={onSelect}
        />
      </Fragment>,
      {organization}
    );

    screen.getByRole('textbox', {name: 'Prior input'}).focus();

    await userEvent.click(screen.getByText('sntryh_****'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.textContent).toContain('sntryh_****');
    expect(window.getSelection()?.toString()).toContain('sntryh_****');
  });

  it('shows prompt creation errors', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Unavailable'},
    });
    render(
      <AgentHandoffPrompt
        context={context}
        feedbackSource={feedbackSource}
        flow={AgentHandoffFlow.ONBOARDING}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy agent prompt'}));

    expect(
      await screen.findByText('Unable to create your agent prompt. Please try again.')
    ).toBeInTheDocument();
  });

  it('explains when a selected prompt is copied before its context is ready', async () => {
    render(
      <AgentHandoffPrompt
        context={null}
        feedbackSource={feedbackSource}
        flow={AgentHandoffFlow.ONBOARDING}
      />,
      {organization}
    );

    fireEvent.copy(screen.getByText('sntryh_****'));

    expect(
      await screen.findByText('Your agent prompt is still being prepared.')
    ).toBeInTheDocument();
  });
});
