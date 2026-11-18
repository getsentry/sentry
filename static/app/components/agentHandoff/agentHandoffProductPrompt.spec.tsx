import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgentHandoffProductPrompt} from './agentHandoffProductPrompt';

describe('AgentHandoffProductPrompt', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const context = {product: 'tracing' as const, projectId: 'proj-123'};
  const feedbackSource = 'traces-empty-state-test';
  const agentSteps = ['Install the Sentry CLI', 'Add tracing', 'Verify traces arrive'];
  const code = 'sntryh_example';
  const handoffId = 'a'.repeat(32);
  const copiedPrompt =
    'Read and follow https://sentry-jest-tests.example.com/agent-handoff.md verbatim to set up tracing. Your handoff code is `sntryh_example`.';
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

  it('copies a prompt that names the product, and links to add_feature instructions', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    const onCopySuccess = jest.fn();

    render(
      <AgentHandoffProductPrompt
        agentSteps={agentSteps}
        context={context}
        feedbackSource={feedbackSource}
        onCopySuccess={onCopySuccess}
      />,
      {organization}
    );

    expect(screen.getByRole('link', {name: 'View all instructions'})).toHaveAttribute(
      'href',
      'https://sentry.io/agent-handoff.md?preview=1&flow=add_feature'
    );
    expect(screen.getByText(/Read and follow/)).toHaveTextContent(
      'Read and follow https://sentry-jest-tests.example.com/agent-handoff.md verbatim to set up tracing. Your handoff code is sntryh_****.'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy prompt'}));

    await waitFor(() => expect(onCopySuccess).toHaveBeenCalledWith(handoffId));
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {context, disableIpPinning: false, flow: 'add_feature'},
      })
    );
    const item = write.mock.calls[0]![0][0] as {data: Record<string, Promise<Blob>>};
    await expect(item.data['text/plain']!.then(blob => blob.text())).resolves.toBe(
      copiedPrompt
    );
  });

  it('shows the IP pinning warning and posts disableIpPinning:true after turning it off', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    render(
      <AgentHandoffProductPrompt
        agentSteps={agentSteps}
        context={context}
        feedbackSource={feedbackSource}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Advanced options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: /Use IP pinning/}));

    expect(
      screen.getByText(/anyone with this prompt can use its handoff code/)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Copy prompt'}));

    await waitFor(() =>
      expect(mint).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          data: {context, disableIpPinning: true, flow: 'add_feature'},
        })
      )
    );
  });

  it('shows prompt creation errors', async () => {
    MockApiClient.addMockResponse({url, method: 'POST', statusCode: 503});
    render(
      <AgentHandoffProductPrompt
        agentSteps={agentSteps}
        context={context}
        feedbackSource={feedbackSource}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy prompt'}));

    expect(
      await screen.findByText('Unable to create your agent prompt. Try again.')
    ).toBeInTheDocument();
  });
});
