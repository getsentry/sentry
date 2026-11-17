import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {AgentHandoffProductPrompt} from './agentHandoffProductPrompt';

describe('AgentHandoffProductPrompt', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const context = {product: 'tracing' as const, projectId: 'proj-123'};
  const feedbackSource = 'traces-empty-state-test';
  const code = 'sntryh_example';
  const handoffId = 'a'.repeat(32);
  const prompt =
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

  it('copies a prompt naming the product', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    const onCopySuccess = jest.fn();

    render(
      <AgentHandoffProductPrompt
        benefits={['Does something useful']}
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

    await waitFor(() => expect(onCopySuccess).toHaveBeenCalledTimes(1));
    expect(onCopySuccess).toHaveBeenCalledWith(handoffId);
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          context,
          disableIpPinning: false,
          flow: 'add_feature',
        },
      })
    );
    const item = write.mock.calls[0]![0][0] as {data: Record<string, Promise<Blob>>};
    await expect(item.data['text/plain']!.then(blob => blob.text())).resolves.toBe(
      prompt
    );
  });

  it('can disable IP pinning before copying', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    render(
      <AgentHandoffProductPrompt
        benefits={['Does something useful']}
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
          data: {
            context,
            disableIpPinning: true,
            flow: 'add_feature',
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
        <AgentHandoffProductPrompt
          benefits={['Does something useful']}
          context={context}
          feedbackSource={feedbackSource}
        />
      </Fragment>,
      {organization}
    );

    screen.getByRole('textbox', {name: 'Prior input'}).focus();

    await userEvent.click(screen.getByText('sntryh_****'));

    expect(document.activeElement?.textContent).toContain('sntryh_****');
    expect(window.getSelection()?.toString()).toContain('sntryh_****');
    expect(screen.getByText('sntryh_****')).toHaveAttribute('data-selected', 'true');

    await userEvent.click(screen.getByRole('textbox', {name: 'Prior input'}));

    expect(screen.getByText('sntryh_****')).not.toHaveAttribute('data-selected');
  });

  it('shows prompt creation errors', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Unavailable'},
    });
    render(
      <AgentHandoffProductPrompt
        benefits={['Does something useful']}
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

  it('explains when a selected prompt is copied before its context is ready', async () => {
    render(
      <AgentHandoffProductPrompt
        benefits={['Does something useful']}
        context={null}
        feedbackSource={feedbackSource}
      />,
      {organization}
    );

    fireEvent.copy(screen.getByText('sntryh_****'));

    expect(
      await screen.findByText('Your agent prompt is still being prepared.')
    ).toBeInTheDocument();
  });

  it('renders the benefit list with the given items', () => {
    render(
      <AgentHandoffProductPrompt
        benefits={['Installs the SDK', 'Adds tracing', 'Sends a test transaction']}
        context={context}
        feedbackSource={feedbackSource}
      />,
      {organization}
    );

    expect(screen.getByText('Your agent will:')).toBeInTheDocument();
    expect(screen.getByText('Installs the SDK')).toBeInTheDocument();
    expect(screen.getByText('Adds tracing')).toBeInTheDocument();
    expect(screen.getByText('Sends a test transaction')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View all instructions'})).toBeInTheDocument();
  });
});
